import { Request, Response, NextFunction } from "express";
import { HTTP400Error, HTTP403Error } from "../utils/httpErrors";
import config from "config";
// import { Utilities } from "../utils/Utilities";

// export const checkUserId = (req: Request, next: NextFunction) => {
//   if (!req.query.id) {
//     throw new HTTP400Error("Id is required");
//   } else {
//     next();
//   }
// };

// export const checkAuthenticate = (req: Request, res: Response, next: NextFunction) => {
//   const token: any = req.get(config.get("AUTHORIZATION"));
//   if (!token) {
//     throw new HTTP400Error({ responseCode: 400, responseMessage: "Token required" });
//   }

//   return Utilities.verifyToken(token).then((result) => { next() })
//     .catch((error) => {
//       throw new HTTP403Error({ responseCode: 403, responseMessage: error.message });
//     });
// };
