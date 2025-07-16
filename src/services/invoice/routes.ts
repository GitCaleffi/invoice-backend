import { NextFunction, Request, Response } from "express";
import 'dotenv/config';
import { deleteInvoiceById, downloadInvoice, getInvoice, getInvoiceDetails, updateInvoice, uploadInvoiceCsv } from "./controller";
import { checkAuthenticate } from "./middleware/check";

const basePath = process.env.BASE_PATH || "/api/v1/";
const currentPath = "invoice";
const currentPathURL = basePath + currentPath;

export default [

  //  get all Invoice list  //
  {
    path: currentPathURL,
    method: "get",
    handler: [
      checkAuthenticate,
      async (req: Request, res: Response, next: NextFunction) => {
        const result = await getInvoice(req.get("Authorization"), req.query, res, next);
        res.status(200).send(result);
      },
    ],
  },

  //  upload Invoice csv  //
  {
    path: currentPathURL + "/uploadCsv",
    method: "post",
    handler: [
      checkAuthenticate,
      async (req: Request, res: Response, next: NextFunction) => {
        const result = await uploadInvoiceCsv(req.get("Authorization"), req.body, res, next);
        res.status(200).send(result);
      },
    ],
  },

  //  download Invoice list   //
  {
    path: currentPathURL + "/downloadCsv",
    method: "get",
    handler: [
      checkAuthenticate,
      async (req: Request, res: Response, next: NextFunction) => {
        const result = await downloadInvoice(req.get("Authorization"), res, next);
        res.status(200).send(result);
      },
    ],
  },

  //  delete Invoice by id  //
  {
    path: currentPathURL + "/:id",
    method: "delete",
    handler: [
      checkAuthenticate,
      async (req: Request, res: Response, next: NextFunction) => {
        const result = await deleteInvoiceById(req.get("Authorization"), req.params, res, next);
        res.status(200).send(result);
      },
    ],
  },

  //  get Invoice by id  //
  {
    path: currentPathURL + '/:id',
    method: "get",
    handler: [
      async (req: Request, res: Response, next: NextFunction) => {
        const result = await getInvoiceDetails(req.get("Authorization"), req.params,res, next);
        res.status(200).send(result);
      },
    ],
  },

  //  update Invoice  //
  {
    path: currentPathURL + '/update',
    method: "post",
    handler: [
      async (req: Request, res: Response, next: NextFunction) => {
        const result = await updateInvoice(req.get("Authorization"), req.body, res, next);
        res.status(200).send(result);
      },
    ],
  },

];
