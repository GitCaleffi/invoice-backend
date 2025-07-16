import jwt from "jsonwebtoken";
import * as bcrypt from "bcrypt";
import * as nodemailer from "nodemailer";
import { HTTP400Error, HTTP404Error, HTTP403Error } from "./httpErrors";
import { invalidTokenError } from "./ErrorHandler";
import { createHash, randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { AppDataSource } from "./ormconfig";
import { Supplier } from "../db/Supplier";
import 'dotenv/config';


export class CommonUtilities {

  /****  Return response in custom format  ******/
  public static sendResponsData(response: any) {
    let result: any = {
      responseCode: response.code,
      responseMessage: response.message,
    };
    if (response.data) {
      result.data = response.data;
    }
    if (response.totalRecord) {
      result.totalRecord = response.totalRecord;
    }
    return result;
  }

  /****  Generate encrypted password  *******/
  public static cryptPassword = async (password: string) => {
    const salt=process.env.SALT || 10;

    return new Promise(function (resolve, reject) {
      return bcrypt.hash(
        password,
        salt,
        (err: any, hash: any) => {
          if (err) {
            return reject(err);
          } else {
            return resolve(hash);
          }
        }
      );
    });
  };

  /****  Verify password  *******/
  public static VerifyPassword = async (password: string, hash: string) => {
    return new Promise(function (resolve, reject) {
      return bcrypt.compare(password, hash, (error: any, result: any) => {
        if (error) {
          return reject(error);
        } else {
          return resolve(result);
        }
      });
    });
  };

  /****  Create jwt token  *****/
  public static createJWTToken = async (payload: any) => {
    const secretKey = process.env.JWT_SECRET_KEY;
    if (typeof secretKey !== 'string') {
      throw new Error('JWT_SECRET_KEY is not defined or not a string');
    }

    return jwt.sign(payload, secretKey, {});
  };

  /****  Verify token is valid or not  ******/
  public static verifyToken = async (token: any) => {
    const secretKey = process.env.JWT_SECRET_KEY;
    if (typeof secretKey !== 'string') {
      throw new Error('JWT_SECRET_KEY is not defined or not a string');
    }

    return new Promise(function (resolve, reject) {
      jwt.verify(
        token,
        secretKey,
        async function (error: any, result: any) {
          if (error) {
            return reject(error);
          } else {
            const userRepository = AppDataSource.getRepository(Supplier);
            const userRes = await userRepository.findOneBy({ accessToken: token });
            if (userRes) {
              return resolve(result);
            } else {
              return reject({ message: "Invalid Token" });
            }
          }
        }
      );
    })
  };

  /**
   * decoded jwt token
   * @param token string
   */
  public static getDecoded = async (token: any) => {
    return jwt.decode(token);
  };

  /**
   * check Super admin or sub admin
   * @param token string
   */
  public static isAdmin = async (token: any) => {
    const decoded: any = await CommonUtilities.getDecoded(token);

    if (
      decoded.user_type === "Super-Admin" ||
      decoded.user_type === "Sub-Admin"
    )
      return true;
    return false;
  };

  /**
   * Generate alphanumer random string of given length
   * @param length
   */
  public static genAlphaNumericCode(length: number) {
    var result = "";
    var characters =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  }

  /**
   * 
   * @param length of otp we want to generate
   * @returns numeric code for specified length
   */
  public static genNumericCode(length: number) {
    let min = Math.pow(10, length - 1);
    let max = (Math.pow(10, length) - Math.pow(10, length - 1) - 1);
    return Math.floor(min + Math.random() * max)
  }

}
