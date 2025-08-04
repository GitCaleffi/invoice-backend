import config from "config";
import * as nodemailer from "nodemailer";
import { HTTP400Error, HTTP404Error, HTTP403Error } from "./httpErrors";
var sgTransport = require('nodemailer-sendgrid-transport');
import 'dotenv/config';
import { CommonUtilities } from "./CommonUtilities";
import { MESSAGES } from "./messages";

export class MailerUtilities {

    public static sendSendgridMail = async (data: any) => {
        console.log("inside sendSendgridMail function")
        var options = {
            auth: {
                api_key: process.env.SENDGRID_API_KEY
            }
        }

        var mailer = nodemailer.createTransport(sgTransport(options));

        var message: any = {
            to: [...data.recipient_email],
            cc: [process.env.SENDGRID_SENDER_EMAIL],
            from: process.env.SENDGRID_SENDER_EMAIL,
            subject: data.subject,
            text: data.text,
            html: data.text,
        };

        if (data.cc) {
            message.cc = [...data.cc]
        }

        if (data.attachments) {
            message.attachments = [
                {
                    filename: 'test.txt',
                    path: __dirname + '/test.txt'
                }
            ]
        }

        try {
            const mailRes = await mailer.sendMail(message);
            console.log("mailRes", mailRes);
            return mailRes;
        }
        catch (err: any) {
            console.error("Failed to send email:", err?.response?.body || err);
            throw new HTTP400Error(
                CommonUtilities.sendResponsData({
                    code: 400,
                    message: MESSAGES.EMAIL_SEND_ERROR,
                })
            );
        }
    }


    public static sendSendgridSMTPMail = async (data: any) => {
        console.log("inside sendSendgridSMTPMail function");

        const transporter = nodemailer.createTransport({
            host: process.env.SENDGRID_SMTP_HOST || "smtp.sendgrid.net",
            port: parseInt(process.env.SENDGRID_SMTP_PORT || "587"),
            secure: false, // false for 587, true for 465
            auth: {
                user: process.env.SENDGRID_SMTP_USER || "apikey", // always "apikey"
                pass: process.env.SENDGRID_API_KEY // your SendGrid API key
            }
        });

        const message: any = {
            from: process.env.SENDGRID_SENDER_EMAIL,
            to: [...data.recipient_email],
            subject: data.subject,
            text: data.text,
            html: data.html || data.text,
        };

        if (data.cc) {
            message.cc = [...data.cc];
        }

        if (data.attachments) {
            message.attachments = data.attachments;
        }

        try {
            const mailRes = await transporter.sendMail(message);
            console.log("SMTP mailRes", mailRes);
            return mailRes;
        }
        catch (err: any) {
            console.error("Failed to send SMTP email:", err?.response || err);
            throw new HTTP400Error(
                CommonUtilities.sendResponsData({
                    code: 400,
                    message: MESSAGES.EMAIL_SEND_ERROR,
                })
            );
        }
    }

}