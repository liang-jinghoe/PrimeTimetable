import express from "express";
const router = express.Router();

import captchaService from "../../../shared/captchaService/index.js";
import encryptor from "../../../shared/encryptor.js";

router.get("/captcha.jpg", function(req, res) {
	let customCookie = req.query.cookie;

	if (customCookie) return res.sendFile(captchaService.getImagePath(customCookie));
	
	let encryptedCookie = req.signedCookies["ucid"];
	let cookie = encryptedCookie ? encryptor.decryptCookie(encryptedCookie) : null;
	
	if (cookie) return res.sendFile(captchaService.getImagePath(cookie), (err) => captchaService.deleteImage(cookie));

	return res.sendFile(captchaService.getImagePath("undefined"));
});

 // TEMPORARY - START

import fs from "fs";

router.get("/captchaFile", function(req, res) {
	var files = fs.readdirSync(`${__dirname}/${sharedPath}/captchaService/cache`);

	return res.send(JSON.stringify(files));
});

// TEMPORARY - END

export default router;
