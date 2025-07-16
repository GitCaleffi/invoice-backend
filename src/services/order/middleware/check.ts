import { Request, Response, NextFunction } from 'express';
import { CommonUtilities } from '../../../utils/CommonUtilities';
import 'dotenv/config';

export const checkAuthenticate = (req: any, res: Response, next: NextFunction) => {
  const token: any = req.get(process.env.AUTHORIZATION);
  CommonUtilities.verifyToken(token)
    .then((result) => {
      req.user = result;
      next();
    })
    .catch((error) => {
      res.status(403)
        .send({ responseCode: 401, responseMessage: error.message, data: {} });
    });
};
