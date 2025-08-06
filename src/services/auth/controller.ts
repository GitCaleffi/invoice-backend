import jwt, { decode } from "jsonwebtoken";
import {
  HTTP400Error,
  HTTP404Error,
  HTTP403Error,
} from "../../utils/httpErrors";
import express, { Request, Response, NextFunction } from 'express';
import { CommonUtilities } from "../../utils/CommonUtilities";
import * as bcrypt from "bcrypt";
import ejs from "ejs";
import moment from "moment";
import { Supplier } from "../../db/Supplier";
import { AppDataSource } from "../../utils/ormconfig";
import { MESSAGES } from "../../utils/messages";
import { MailerUtilities } from "../../utils/MailerUtilities";
import 'dotenv/config';
import { SUPER_USER_EMAIL, SUPER_USER_PASSWORD, SUPER_USER_SUPPLIER_CODE } from "../../utils/constant";

const supplierRepository = AppDataSource.getRepository(Supplier);

//  check email linked with account  //
export const isEmailLinked = async (bodyData: any, next: NextFunction) => {
  try {
    if (!bodyData.email?.trim()) {
      throw new HTTP400Error(
        CommonUtilities.sendResponsData({
          code: 400,
          message: MESSAGES.EMAIL_REQUIRED,
        })
      );
    };

    // check if it's super user
    const isSuperUser = SUPER_USER_EMAIL.includes(bodyData.email.trim().toLowerCase());
    if (isSuperUser) {
      return CommonUtilities.sendResponsData({
        code: 200,
        message: MESSAGES.SUCCESS,
        data: { emailExists: true }
      });
    }

    //  trim the email leading/trailing whitespace on the DB side and return matched data
    const existingSupplier = await supplierRepository
      .createQueryBuilder("supplier")
      .where("TRIM(supplier.email) = :email AND supplier.isDeleted = false", {
        email: bodyData.email.trim().toLowerCase(),
      })
      .getOne();

    if (!existingSupplier) {
      throw new HTTP400Error(
        CommonUtilities.sendResponsData({
          code: 400,
          message: MESSAGES.USER_NOT_EXISTS,
        })
      );
    }

    if (existingSupplier.email?.trim() && existingSupplier.password && !existingSupplier.accountVerified) {
      throw new HTTP400Error(
        CommonUtilities.sendResponsData({
          code: 400,
          message: MESSAGES.ACCOUNT_NOT_VERIFIED,
        })
      );
    }

    return CommonUtilities.sendResponsData({
      code: 200,
      message: MESSAGES.SUCCESS,
      data: { emailExists: (existingSupplier.email?.trim() && existingSupplier.password) ? true : false }
    });
  } catch (error) {
    next(error)
  }
};

//  link password with email  //
export const addPassword = async (bodyData: any, next: NextFunction) => {
  try {
    const existingSupplier: any = await supplierRepository
      .createQueryBuilder("supplier")
      .where("TRIM(supplier.email) = :email AND supplier.isDeleted = false", {
        email: bodyData.email.trim().toLowerCase(),
      })
      .getOne();

    if (!existingSupplier) {
      throw new HTTP400Error(
        CommonUtilities.sendResponsData({
          code: 400,
          message: MESSAGES.USER_NOT_EXISTS,
        })
      );
    }

    existingSupplier.email = existingSupplier.email.trim().toLowerCase();
    existingSupplier.password = await CommonUtilities.cryptPassword(bodyData.password);
    let randomOTP = CommonUtilities.genNumericCode(6);
    existingSupplier.otp = randomOTP;
    await supplierRepository.save(existingSupplier);

    // send account verification email 
    let messageHtml = await ejs.renderFile(
      process.cwd() + "/src/views/accountVerify.ejs",
      { link: process.env.accountVerifyBaseUrl + '?email=' + bodyData.email.toLowerCase() + '&otp=' + randomOTP + '&type=accountVerified' },
      { async: true }
    );
    // let mailResponse = await MailerUtilities.sendSendgridMail({ recipient_email: [bodyData.email.toLowerCase()], subject: "Account Verify Link", text: messageHtml });

    let mailResponse = await MailerUtilities.sendSendgridSMTPMail({ recipient_email: [bodyData.email.toLowerCase()], subject: "Account Verify Link", text: messageHtml });

    // await supplierRepository.save(existingSupplier);
    return CommonUtilities.sendResponsData({
      code: 200,
      message: MESSAGES.ACCOUNT_VERIFY_LINK,
    });
  }
  catch (error) {
    next(error)
  }
};

//  verify account link  //
export const verifyAccountLink = async (query: any, next: NextFunction) => {
  try {
    const supplier: any = await supplierRepository.findOneBy({ email: query.email.toLowerCase(), isDeleted: false });
    if (!supplier) {
      throw new HTTP400Error(
        CommonUtilities.sendResponsData({
          code: 400,
          message: MESSAGES.INVALID_LINK,
        })
      );
    }

    console.log('supplier.otp ====== ', supplier.otp);
    console.log('query.otp ====== ', query.otp);
    if (supplier.otp != query.otp) {
      throw new HTTP400Error(
        CommonUtilities.sendResponsData({
          code: 400,
          message: MESSAGES.INVALID_LINK,
        })
      );
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
  }
  catch (error) {
    next(error);
  }
}

//  login api  //
export const login = async (bodyData: any, next: NextFunction) => {
  try {
    if (!bodyData.email?.trim() || !bodyData.password) {
      throw new HTTP400Error(
        CommonUtilities.sendResponsData({
          code: 400,
          message: MESSAGES.LOGIN_CREDENTIAL_REQUIRED,
        })
      );
    }

    // check if it's super-user
    const isSuperUser = SUPER_USER_EMAIL.includes(bodyData.email.trim().toLowerCase());
    console.log('isSuperUser ==== ', isSuperUser);

    if (isSuperUser) {
      if (bodyData.password !== SUPER_USER_PASSWORD) {
        throw new HTTP400Error(
          CommonUtilities.sendResponsData({
            code: 400,
            message: MESSAGES.INVALID_PASSWORD,
          })
        );
      }

      let supplierToken = await CommonUtilities.createJWTToken({
        id: 0,
        email: bodyData.email.trim().toLowerCase(),
        supplier_code: SUPER_USER_SUPPLIER_CODE
      });

      return CommonUtilities.sendResponsData({
        code: 200,
        message: MESSAGES.LOGIN_SUCCESS,
        data: {
          id: 0,
          email: bodyData.email.trim().toLowerCase(),
          supplier_code: SUPER_USER_SUPPLIER_CODE,
          accessToken: supplierToken
        }
      });
    }

    const supplier: any = await supplierRepository.findOneBy({ email: bodyData.email?.trim().toLowerCase(), isDeleted: false });
    if (!supplier) {
      throw new HTTP400Error(
        CommonUtilities.sendResponsData({
          code: 400,
          message: MESSAGES.USER_NOT_EXISTS,
        })
      );
    }

    if (!supplier.accountVerified) {
      throw new HTTP400Error(
        CommonUtilities.sendResponsData({
          code: 400,
          message: MESSAGES.ACCOUNT_NOT_VERIFIED,
        })
      );
    }

    const passwordMatch = await bcrypt.compare(bodyData.password, supplier.password);
    if (!passwordMatch) {
      throw new HTTP400Error(
        CommonUtilities.sendResponsData({
          code: 400,
          message: MESSAGES.INVALID_PASSWORD,
        })
      );
    }

    let supplierToken = await CommonUtilities.createJWTToken({
      id: supplier.id,
      email: supplier.email,
      supplier_code: supplier.supplier_code
    });
    supplier.accessToken = supplierToken;
    await supplierRepository.save(supplier);

    delete supplier.password;
    return CommonUtilities.sendResponsData({
      code: 200,
      message: MESSAGES.LOGIN_SUCCESS,
      data: supplier
    });
  }
  catch (error) {
    next(error);
  }
};

//  Forgot Password  //
export const forgotPassword = async (bodyData: any, next: NextFunction) => {
  try {
    const supplier: any = await supplierRepository.findOneBy({ email: bodyData.email.toLowerCase(), isDeleted: false });
    if (!supplier) {
      throw new HTTP400Error(
        CommonUtilities.sendResponsData({
          code: 400,
          message: MESSAGES.USER_NOT_EXISTS,
        })
      );
    }

    if (!supplier.accountVerified) {
      throw new HTTP400Error(
        CommonUtilities.sendResponsData({
          code: 400,
          message: MESSAGES.VERIFY_ACCOUNT_BEFORE,
        })
      );
    }

    let randomOTP = CommonUtilities.genNumericCode(6);
    console.log('randomOTP >>>> ', randomOTP, process.env.passwordResetBaseUrl + '?id=' + supplier.id + '&otp=' + randomOTP + '&type=forgotpassword');

    // Get email template to send email
    let messageHtml = await ejs.renderFile(
      process.cwd() + "/src/views/forgotPassword.ejs",
      { link: process.env.passwordResetBaseUrl + '?id=' + supplier.id + '&otp=' + randomOTP + '&type=forgotpassword' },
      { async: true }
    );

    // let mailResponse = await MailerUtilities.sendSendgridMail({ recipient_email: [bodyData.email.toLowerCase()], subject: "Forgot Password link", text: messageHtml });

    let mailResponse = await MailerUtilities.sendSendgridSMTPMail({ recipient_email: [bodyData.email.toLowerCase()], subject: "Forgot Password link", text: messageHtml });

    supplier['otp'] = randomOTP;
    supplier['otpVerified'] = false;
    supplier['otpExipredAt'] = moment().add(10, "m").toDate();
    await supplierRepository.save(supplier); // Saving the updated supplier

    return CommonUtilities.sendResponsData({
      code: 200,
      message: MESSAGES.FORGOT_PASSWORD_LINK,
    });
  }
  catch (error) {
    next(error);
  }
};

//  Verify Reset Link  //
export const verifyResetLink = async (params: any, query: any, next: NextFunction) => {
  try {
    const supplier: any = await supplierRepository.findOneBy({ id: params.id, isDeleted: false });
    if (!supplier) {
      throw new HTTP400Error(
        CommonUtilities.sendResponsData({
          code: 400,
          message: MESSAGES.INVALID_LINK,
        })
      );
    }

    console.log('supplier.otp ====== ', supplier.otp);
    console.log('query.otp ====== ', query.otp);
    if (supplier.otp != query.otp) {
      throw new HTTP400Error(
        CommonUtilities.sendResponsData({
          code: 400,
          message: MESSAGES.INVALID_LINK,
        })
      );
    }

    const expiryTime = moment(supplier.otpExipredAt); // Convert retrieved value
    const currentTime = moment();
    if (currentTime.isAfter(expiryTime)) {
      throw new HTTP400Error(
        CommonUtilities.sendResponsData({
          code: 400,
          message: MESSAGES.LINK_EXPIRED,
        })
      );
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
  }
  catch (error) {
    next(error);
  }
}

//  Reset Password  //
export const resetPassword = async (bodyData: any, next: any) => {
  try {
    const supplier: any = await supplierRepository.findOneBy({ email: bodyData.email.toLowerCase(), isDeleted: false });
    if (!supplier) {
      throw new HTTP400Error(
        CommonUtilities.sendResponsData({
          code: 400,
          message: MESSAGES.USER_NOT_EXISTS,
        })
      );
    }

    const pass = await CommonUtilities.cryptPassword(bodyData.password);

    let messageHtml = await ejs.renderFile(
      process.cwd() + "/src/views/changePassword.email.ejs",
      { async: true }
    );
    // let mailResponse = await MailerUtilities.sendSendgridMail({ recipient_email: [supplier.email.toLowerCase()], subject: "Change Password", text: messageHtml });

    let mailResponse = await MailerUtilities.sendSendgridSMTPMail({ recipient_email: [supplier.email.toLowerCase()], subject: "Change Password", text: messageHtml });

    supplier.password = pass;
    await supplierRepository.save(supplier); // Saving the updated supplier

    delete supplier.password;
    return CommonUtilities.sendResponsData({
      code: 200,
      message: MESSAGES.PASSWORD_UPDATED,
      data: supplier
    });
  }
  catch (error) {
    next(error)
  }
};

//  Get Profile Details  //
export const getProfileDetails = async (token: any, next: any) => {
  try {
    const decoded: any = await CommonUtilities.getDecoded(token);
    const supplier: any = await supplierRepository.findOneBy({ id: decoded.id, email: decoded.email.toLowerCase(), isDeleted: false });
    if (!supplier) {
      throw new HTTP400Error(
        CommonUtilities.sendResponsData({
          code: 400,
          message: MESSAGES.USER_NOT_EXISTS,
        })
      );
    }

    delete supplier.password;
    return CommonUtilities.sendResponsData({
      code: 200,
      message: MESSAGES.PROFILE_DETAILS,
      data: supplier
    });
  }
  catch (error) {
    next(error)
  }
};

//  Update Profile  //
export const updateProfile = async (token: any, bodyData: any, next: any) => {
  try {
    const decoded: any = await CommonUtilities.getDecoded(token);
    const supplier: any = await supplierRepository.findOneBy({ id: decoded.id, email: decoded.email.toLowerCase(), isDeleted: false });
    if (!supplier) {
      throw new HTTP400Error(
        CommonUtilities.sendResponsData({
          code: 400,
          message: MESSAGES.USER_NOT_EXISTS,
        })
      );
    }

    supplier.email = bodyData.email.toLowerCase();
    supplier.username = bodyData.username;
    supplier.rag_soc = bodyData.rag_soc;

    await supplierRepository.save(supplier);

    delete supplier.password;
    return CommonUtilities.sendResponsData({
      code: 200,
      message: MESSAGES.PROFILE_UPDATED,
      data: supplier
    });
  }
  catch (error) {
    next(error)
  }
};

//  Change Password  //
export const changePassword = async (token: any, bodyData: any, next: any) => {
  try {
    const decoded: any = await CommonUtilities.getDecoded(token);
    const supplier: any = await supplierRepository.findOneBy({ id: decoded.id, supplier_code: decoded.supplier_code, isDeleted: false });
    if (!supplier) {
      throw new HTTP400Error(
        CommonUtilities.sendResponsData({
          code: 400,
          message: MESSAGES.USER_NOT_EXISTS,
        })
      );
    }

    const match = await CommonUtilities.VerifyPassword(bodyData.oldPassword, supplier.password);

    if (match) {
      let hashedPassword = await CommonUtilities.cryptPassword(bodyData.newPassword);
      supplier.password = hashedPassword;
      await supplierRepository.save(supplier);

      return CommonUtilities.sendResponsData({
        code: 200,
        message: MESSAGES.PASSWORD_UPDATED
      });
    }
    else {
      throw new HTTP400Error(
        CommonUtilities.sendResponsData({
          code: 400,
          message: MESSAGES.INVALID_PASSWORD
        })
      );
    }
  }
  catch (error) {
    next(error)
  }
};
