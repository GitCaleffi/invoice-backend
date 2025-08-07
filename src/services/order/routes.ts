import { NextFunction, Request, Response } from "express";
import 'dotenv/config';
import { getOrders } from "./controller";
import { checkAuthenticate } from "./middleware/check";

const basePath = process.env.BASE_PATH || "/api/v1/";
const currentPath = "orders";
const currentPathURL = basePath + currentPath;

export default [

  //  get all orders list  //
  {
    path: currentPathURL,
    method: "get",
    handler: [
      checkAuthenticate,
      async (req: Request, res: Response, next: NextFunction) => {
        const result = await getOrders(req.get("Authorization"), req.query, res, next);
        res.status(200).send(result);
      },
    ],
  },
  
];

