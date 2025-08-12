const { COOKIE_PRASER_SECRET } = process.env;

import express from "express";
import cookieParser from "cookie-parser";

const app = express();

import captcha from "./routes/captcha/index.js";
import images from "./routes/images/index.js";
import login from "./routes/login/index.js";
import bid from "./routes/bid/index.js";
import payment from "./routes/payment/index.js";
import logout from "./routes/logout/index.js";

import slots from "./routes/slots/index.js"; // Testing

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set("views", `${__dirname}/views`)
app.set("view engine", "ejs");

app.use(cookieParser(COOKIE_PRASER_SECRET));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(captcha);
app.use(images);
app.use(login);
app.use(bid);
app.use(payment);
app.use(logout);
app.use(slots); // Testing
app.use("/css", express.static(`${__dirname}/css`));

app.use(async function(req, res, next) {
	let encryptedCookie = req.signedCookies["ucid"];
	
	if (!encryptedCookie && req.originalUrl !== "/health") return res.redirect("/login");
	
	next();
});

app.get("/health", function(req, res) {
	return res.status(200).end();
});

export default app;
