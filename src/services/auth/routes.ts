import { NextFunction, Request, Response } from "express";
import 'dotenv/config';
import { isEmailLinked, addPassword, forgotPassword, getProfileDetails, login, resetPassword, updateProfile, verifyAccountLink, verifyResetLink, changePassword } from "./controller";

const basePath = process.env.BASE_PATH || "/api/v1/";
const currentPath = "auth";
const currentPathURL = basePath + currentPath;

export default [

  //  check email linked with account  //
  {
    path: currentPathURL + "/isEmailLinked",
    method: "post",
    handler: [
      async (req: Request, res: Response, next: NextFunction) => {
        const result = await isEmailLinked(req.body, next);
        res.status(200).send(result);
      },
    ],
  },

  //  link password with email  //
  {
    path: currentPathURL + "/addPassword",
    method: "post",
    handler: [
      async (req: Request, res: Response, next: NextFunction) => {
        const result = await addPassword(req.body, next);
        res.status(200).send(result);
      },
    ],
  },

  //  verify account link  //
  {
    path: currentPathURL + '/verifyAccount',
    method: "get",
    handler: [
      async (req: Request, res: Response, next: NextFunction) => {
        const result = await verifyAccountLink(req.query, next);
        res.status(200).send(result);
      },
    ],
  },

  //  login  //
  {
    path: currentPathURL + "/login",
    method: "post",
    handler: [
      async (req: Request, res: Response, next: NextFunction) => {
        const result = await login(req.body, next);
        res.status(200).send(result);
      },
    ],
  },

  //  forgot Password  //
  {
    path: currentPathURL + '/forgotPassword',
    method: "post",
    handler: [
      async (req: Request, res: Response, next: NextFunction) => {
        const result = await forgotPassword(req.body, next);
        res.status(200).send(result);
      },
    ],
  },

  //  verify forgot Password link  //
  {
    path: currentPathURL + '/resetLink/:id',
    method: "get",
    handler: [
      async (req: Request, res: Response, next: NextFunction) => {
        const result = await verifyResetLink(req.params, req.query, next);
        res.status(200).send(result);
      },
    ],
  },

  // reset password  //
  {
    path: currentPathURL + '/resetPassword',
    method: "put",
    handler: [
      async (req: Request, res: Response, next: NextFunction) => {
        const result = await resetPassword(req.body, next);
        res.status(200).send(result);
      },
    ],
  },

  //  get profile details  //
  {
    path: currentPathURL + '/profileDetails',
    method: "get",
    handler: [
      async (req: Request, res: Response, next: NextFunction) => {
        const result = await getProfileDetails(req.get("Authorization"), next);
        res.status(200).send(result);
      },
    ],
  },

  //  update profile  //
  {
    path: currentPathURL + '/updateProfile',
    method: "post",
    handler: [
      async (req: Request, res: Response, next: NextFunction) => {
        const result = await updateProfile(req.get("Authorization"), req.body, next);
        res.status(200).send(result);
      },
    ],
  },

  // change password  //
  {
    path: currentPathURL + '/changePassword',
    method: "put",
    handler: [
      async (req: Request, res: Response, next: NextFunction) => {
        const result = await changePassword(req.get("Authorization"), req.body, next);
        res.status(200).send(result);
      },
    ],
  },

];
