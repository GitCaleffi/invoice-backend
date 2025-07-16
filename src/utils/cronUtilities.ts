import { AppDataSource } from "./ormconfig";
import { Supplier } from "../db/Supplier";
import ejs from "ejs";
import { MailerUtilities } from "./MailerUtilities";
import { io } from '../server'; //  adjust path as needed
import { CommonUtilities } from "./CommonUtilities";
import axios from "axios";
import { MESSAGES } from "./messages";
import { In, LessThan } from "typeorm";


export class CronUtilities {

}
