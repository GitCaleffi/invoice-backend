import { NextFunction, Request, Response } from "express";
import 'dotenv/config';
import {  getInvoices, uploadInvoiceCsv ,addMappedHeaders, getInvoicesHeaders} from "./controller";
import { checkAuthenticate } from "./middleware/check";

const basePath = process.env.BASE_PATH || "/api/v1/";
const currentPath = "invoiceMapping";
const currentPathURL = basePath + currentPath;

export default [

  //  get all Invoice list  //
  {
    path: currentPathURL,
    method: "get",
    handler: [
      checkAuthenticate,
      async (req: Request, res: Response, next: NextFunction) => {
        const result = await getInvoices(req.get("Authorization"), req.query, next);
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
        const result = await uploadInvoiceCsv(req.get("Authorization"), req.body, next);
        res.status(200).send(result);
      },
    ],
  },

  //  add mapping headers  // 
  {
    path: currentPathURL + "/addMappingHeaders",
    method: "post",
    handler: [
      checkAuthenticate,
      async (req: Request, res: Response, next: NextFunction) => {
        const result = await addMappedHeaders(req.get("Authorization"), req.body, next);
        res.status(200).send(result);
      },
    ],
  },

  // get invoice headers
  {
    path: currentPathURL + "/mappedHeaders",
    method: "get",
    handler: [
      checkAuthenticate,
      async (req: Request, res: Response, next: NextFunction) => {
        const result = await getInvoicesHeaders(req.get("Authorization"), next);
        res.status(200).send(result);
      },
    ],
  },
];
