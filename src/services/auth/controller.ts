import jwt, { decode } from "jsonwebtoken";
import {
  HTTP400Error,
  HTTP404Error,
  HTTP403Error,
} from "../../utils/httpErrors";
import express, { Request, Response, NextFunction } from 'express';

import config from "config";
import { CommonUtilities } from "../../utils/CommonUtilities";
import * as bcrypt from "bcrypt";
import ejs from "ejs";
import moment from "moment";
import { Supplier } from "../../db/Supplier";
import { AppDataSource } from "../../utils/ormconfig";
import { MESSAGES } from "../../utils/messages";
import { MailerUtilities } from "../../utils/MailerUtilities";
import 'dotenv/config';



//  new supplier register api  //
export const register = async (bodyData: any, res: Response, next: NextFunction) => {
  try {
    const supplierRepository = AppDataSource.getRepository(Supplier);

    // Check if supplier already exists
    const existingSupplier = await supplierRepository.findOneBy({ email: bodyData.email.toLowerCase(), isDeleted: false });
    if (existingSupplier) {
      return res.status(400).json(CommonUtilities.sendResponsData({
        code: 400,
        message: MESSAGES.USER_EXISTS,
      }));
    }

    const hashedPassword: any = await CommonUtilities.cryptPassword(bodyData.password);
    let randomOTP = CommonUtilities.genNumericCode(6);

    const supplierObj = new Supplier();
    supplierObj.email = bodyData.email.toLowerCase();
    supplierObj.password = hashedPassword;
    supplierObj.otp = randomOTP;

    console.log('supplierObj ===== ', supplierObj);
    await AppDataSource.manager.save(supplierObj);

    // send account verification email 
    let messageHtml = await ejs.renderFile(
      process.cwd() + "/src/views/accountVerify.ejs",
      { link: process.env.accountVerifyBaseUrl + '?email=' + bodyData.email.toLowerCase() + '&otp=' + randomOTP + '&type=accountVerified' },
      { async: true }
    );
    let mailResponse = await MailerUtilities.sendSendgridMail({ recipient_email: [bodyData.email], subject: "Account Verify Link", text: messageHtml });

    return CommonUtilities.sendResponsData({
      code: 200,
      message: MESSAGES.ACCOUNT_VERIFY_LINK,
    });
  } catch (error) {
    next(error)
  }
};

//  login api  //
export const login = async (bodyData: any, res: Response, next: NextFunction) => {
  try {
    if (!bodyData.email || !bodyData.password) {
      return res.status(400).json(CommonUtilities.sendResponsData({
        code: 400,
        message: MESSAGES.EMAIL_PASS_REQUIRED,
      }));
    }

    const supplierRepository = AppDataSource.getRepository(Supplier);
    const supplier: any = await supplierRepository.findOneBy({ email: bodyData.email.toLowerCase(), isDeleted: false });

    if (!supplier) {
      return res.status(400).json(CommonUtilities.sendResponsData({
        code: 400,
        message: MESSAGES.USER_NOT_EXISTS,
      }));
    }
    const passwordMatch = await bcrypt.compare(bodyData.password, supplier.password);
    if (!passwordMatch) {
      return res.status(400).json(CommonUtilities.sendResponsData({
        code: 400,
        message: MESSAGES.INVALID_PASSWORD,
      }));
    }

    if (!supplier.accountVerified) {
      return res.status(400).json(CommonUtilities.sendResponsData({
        code: 400,
        message: MESSAGES.ACCOUNT_NOT_VERIFIED,
      }));
    }

    let supplierToken = await CommonUtilities.createJWTToken({
      id: supplier.id,
      email: supplier.email
    });
    supplier.accessToken = supplierToken;
    await supplierRepository.save(supplier); // Saving the updated supplier

    delete supplier.password;
    return CommonUtilities.sendResponsData({
      code: 200,
      message: MESSAGES.LOGIN_SUCCESS,
      data: supplier
    });

  } catch (error) {
    next(error);
  }
};

//  verify account link  //
export const verifyAccountLink = async (query: any, res: Response, next: NextFunction) => {
  try {
    const supplierRepository = AppDataSource.getRepository(Supplier);
    const supplier: any = await supplierRepository.findOneBy({ email: query.email.toLowerCase(), isDeleted: false });

    if (!supplier) {
      return res.status(400).json(CommonUtilities.sendResponsData({
        code: 400,
        message: MESSAGES.INVALID_LINK,
      }));
    }

    console.log('supplier.otp ====== ', supplier.otp);
    console.log('query.otp ====== ', query.otp);
    if (supplier.otp != query.otp) {
      return res.status(400).json(CommonUtilities.sendResponsData({
        code: 400,
        message: MESSAGES.INVALID_LINK,
      }));
    }

    supplier.otp = 0;
    supplier.accountVerified = true;
    await supplierRepository.save(supplier); // Saving the updated supplier

    delete supplier.password;
    return CommonUtilities.sendResponsData({
      code: 200,
      message: MESSAGES.LINK_VERIFIED,
      data: supplier
    });
  } catch (error) {
    next(error);
  }
}

//  Forgot Password  //
export const forgotPassword = async (bodyData: any, res: Response, next: NextFunction) => {
  try {
    const supplierRepository = AppDataSource.getRepository(Supplier);
    const supplier: any = await supplierRepository.findOneBy({ email: bodyData.email.toLowerCase(), isDeleted: false });

    if (!supplier) {
      return res.status(400).json(CommonUtilities.sendResponsData({
        code: 400,
        message: MESSAGES.USER_NOT_EXISTS,
      }));
    }

    if (!supplier.accountVerified) {
      return res.status(400).json(CommonUtilities.sendResponsData({
        code: 400,
        message: MESSAGES.VERIFY_ACCOUNT_BEFORE,
      }));
    }

    let randomOTP = CommonUtilities.genNumericCode(6);
    console.log('randomOTP >>>> ', randomOTP, process.env.passwordResetBaseUrl + '?id=' + supplier.id + '&otp=' + randomOTP + '&type=forgotpassword');

    // Get email template to send email
    let messageHtml = await ejs.renderFile(
      process.cwd() + "/src/views/forgotPassword.ejs",
      { link: process.env.passwordResetBaseUrl + '?id=' + supplier.id + '&otp=' + randomOTP + '&type=forgotpassword' },
      { async: true }
    );

    let mailResponse = await MailerUtilities.sendSendgridMail({ recipient_email: [bodyData.email], subject: "Forgot Password link", text: messageHtml });

    supplier['otp'] = randomOTP;
    supplier['otpVerified'] = false;
    supplier['otpExipredAt'] = moment().add(10, "m").toDate();
    await supplierRepository.save(supplier); // Saving the updated supplier

    return CommonUtilities.sendResponsData({
      code: 200,
      message: "Mail is sent with link",
    });
  } catch (error) {
    next(error);
  }
};

//  Verify Reset Link  //
export const verifyResetLink = async (params: any, query: any, res: Response, next: NextFunction) => {
  try {
    const supplierRepository = AppDataSource.getRepository(Supplier);
    const supplier: any = await supplierRepository.findOneBy({ id: params.id, isDeleted: false });

    if (!supplier) {
      return res.status(400).json(CommonUtilities.sendResponsData({
        code: 400,
        message: MESSAGES.INVALID_LINK,
      }));
    }

    console.log('supplier.otp ====== ', supplier.otp);
    console.log('query.otp ====== ', query.otp);
    if (supplier.otp != query.otp) {
      return res.status(400).json(CommonUtilities.sendResponsData({
        code: 400,
        message: MESSAGES.INVALID_LINK,
      }));
    }

    const expiryTime = moment(supplier.otpExipredAt); // Convert retrieved value
    const currentTime = moment();
    if (currentTime.isAfter(expiryTime)) {
      return res.status(400).json(CommonUtilities.sendResponsData({
        code: 400,
        message: MESSAGES.LINK_EXPIRED,
      }));
    }

    supplier.otp = 0;
    supplier.otpVerified = true;
    await supplierRepository.save(supplier); // Saving the updated supplier

    delete supplier.password;

    return CommonUtilities.sendResponsData({
      code: 200,
      message: MESSAGES.LINK_VERIFIED,
      data: supplier
    });
  } catch (error) {
    next(error);
  }
}

//  Reset Password  //
export const resetPassword = async (bodyData: any, res: Response, next: any) => {
  try {
    const supplierRepository = AppDataSource.getRepository(Supplier);
    const supplier: any = await supplierRepository.findOneBy({ email: bodyData.email.toLowerCase(), isDeleted: false });

    if (!supplier) {
      return res.status(400).json(CommonUtilities.sendResponsData({
        code: 400,
        message: MESSAGES.USER_NOT_EXISTS,
      }));
    }

    const pass = await CommonUtilities.cryptPassword(bodyData.password);

    let messageHtml = await ejs.renderFile(
      process.cwd() + "/src/views/changePassword.email.ejs",
      { async: true }
    );

    let mailResponse = await MailerUtilities.sendSendgridMail({ recipient_email: [supplier.email], subject: "Change Password", text: messageHtml });

    supplier.password = pass;
    await supplierRepository.save(supplier); // Saving the updated supplier

    delete supplier.password;

    return CommonUtilities.sendResponsData({
      code: 200,
      message: MESSAGES.PASSWORD_UPDATED,
      data: supplier
    });

  } catch (error) {
    next(error)
  }
};

//  Get Profile Details  //
export const getProfileDetails = async (token: any, res: Response, next: any) => {
  try {
    const decoded: any = await CommonUtilities.getDecoded(token);
    const supplierRepository = AppDataSource.getRepository(Supplier);
    const supplier: any = await supplierRepository.findOneBy({ id: decoded.id, email: decoded.email.toLowerCase(), isDeleted: false });
    if (!supplier) {
      return res.status(400).json(CommonUtilities.sendResponsData({
        code: 400,
        message: MESSAGES.USER_NOT_EXISTS,
      }));
    }

    delete supplier.password;

    return CommonUtilities.sendResponsData({
      code: 200,
      message: MESSAGES.PROFILE_DETAILS,
      data: supplier
    });

  } catch (error) {
    next(error)
  }
};

//  Update Profile  //
export const updateProfile = async (token: any, bodyData: any, res: Response, next: any) => {
  try {
    const decoded: any = await CommonUtilities.getDecoded(token);
    const supplierRepository = AppDataSource.getRepository(Supplier);
    const supplier: any = await supplierRepository.findOneBy({ id: decoded.id, email: decoded.email.toLowerCase(), isDeleted: false });
    if (!supplier) {
      return res.status(400).json(CommonUtilities.sendResponsData({
        code: 400,
        message: MESSAGES.USER_NOT_EXISTS,
      }));
    }

    supplier.email = bodyData.email.toLowerCase();
    supplier.shopAddress = bodyData.shopAddress;
    supplier.companyName = bodyData.companyName;
    supplier.vat = bodyData.vat;
    supplier.street = bodyData.street;
    supplier.houseNumber = bodyData.houseNumber;
    supplier.zipCode = bodyData.zipCode;
    supplier.country = bodyData.country;
    supplier.city = bodyData.city;
    supplier.provinceCode = bodyData.provinceCode;
    supplier.phone = bodyData.phone;
    supplier.accountTargetMargin = bodyData.accountTargetMargin;
    supplier.pec = bodyData.pec;
    supplier.sdi = bodyData.sdi;

    await supplierRepository.save(supplier);

    delete supplier.password;

    return CommonUtilities.sendResponsData({
      code: 200,
      message: MESSAGES.PROFILE_UPDATED,
      data: supplier
    });

  } catch (error) {
    next(error)
  }
};
