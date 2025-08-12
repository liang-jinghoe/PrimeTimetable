import express from "express";
const router = express.Router();

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import db from "../../../db/index.js";

import forwardRequest from "../../../shared/forwardRequest.js";
import captchaService from "../../../shared/captchaService/index.js";
import timetableService from "../../../shared/timetableService.js";
import userService from "../../../shared/userService.js";
import encryptor from "../../../shared/encryptor.js";
import logService from "../../../shared/logService.js";

const { ADMIN_ID, ADMIN_SECRET, PROMOCODE_90, PROMOCODE_95, PROMOCODE_100 } = process.env;

router.get("/", async function(req, res) {
	return res.redirect("/login");
});

router.get("/login", async function(req, res) {
	let { response, cookie, error } = await forwardRequest(req, res, "https://unitreg.utar.edu.my/portal/Kaptcha.jpg");
	if (error) return console.log(`ERROR: ${error}`);
	
	let result = await captchaService.downloadImage(cookie, response);
	if (result.error) return console.log(`DOWNLOAD ERROR: ${result}`);

	return res.render("login", { 'PROMOCODE_95': PROMOCODE_95, 'PROMOCODE_100': PROMOCODE_100 });		
});

router.post("/login", async function(req, res) {
	let { id, password, captcha } = req.body;

	if (id == ADMIN_ID && password == ADMIN_SECRET) {
		await res.cookie("utartimetable", "secret password for utartimetable", {
			secure: true,
			httpOnly: true,
			signed: true
		});

		return res.redirect("/admin/keyin");
	};
	
	let { response, cookie, error } = await forwardRequest(req, res, "https://unitreg.utar.edu.my/portal/courseRegStu/loginProSurvey.jsp", {
		body: `reqFregkey=${id}&reqPassword=${password}&kaptchafield=${captcha}`,
		method: "POST",
	});
	if (error) return console.log(`ERROR 1: \n${error}`);
	
	if (!!response.url.match(/loginerror/i)) return res.redirect("/login?a=1"); // Wrong ID or Password
	if (!!response.url.match(/invalidsecurity/i)) return res.redirect("/login?b=1"); // Failed Captcha

	let result = await forwardRequest(req, res, "https://unitreg.utar.edu.my/portal/courseRegStu/registration/studentRegistrationSurvey.jsp");

	if (result.error) return console.log(`ERROR 2: ${result.error}`);

	let html = await result.response.text();
	let welcomeMsg = html.match(/Welcome, ([^\n\r]+) \([0-9]{2}[A-Z]+[0-9]{4,}\)/);

	if (html.match(/<script[^\n\r]*>[^\n\r]*sessionExpiredSurvey[^\n\r]*<\/script>/i)) return res.redirect("/login?c=1"); // Expired
	if (!welcomeMsg) {
		console.log(result.response.url);
		console.log(html);
		
		return res.redirect("/login?d=1"); // Unknown
	};
	
	let name = welcomeMsg[1];
	let campus = html.match(/(?<=<td[^\>]*?>\s*campus\s*<\/td>\s*<td[^\>]*?>\s*)[\w\s]+(?=\s*<\/td>)/i).toString();
	let faculty = html.match(/(?<=<td[^\>]*?>\s*faculty\s*<\/td>\s*<td[^\>]*?>\s*)[\w\s]+(?=\s*<\/td>)/i).toString();
	let time = html.match(/(?<=duration[\s\S]*?)(\d{1,2})\/(\d{1,2})\/(\d{4})\s*?(\d{2}):(\d{2}):(\d{2})/i);
	let [_, day, month, year, hour, minute, second] = time || [];

	if (time) {
		time = new Date(`${year}-${month}-${day} ${hour}:${minute}:${second}.000+08:00`);
	};

	if (!campus.match(/(sungai long|kampar)/i))
		campus = "";

	if (!faculty.match(/^[A-Z\s]+$/))
		faculty = "";
	
	let user = { id: id, name: name, password: password, payment: { items: [], discounts: [] }, selectedSlots: [], time: time, claimPromoCode: false };
	let courses = [];
	
	for (let page = 1; page > 0; page++) {
		result = await forwardRequest(req, res, `https://unitreg.utar.edu.my/portal/courseRegStu/schedule/masterScheduleSurvey.jsp?reqCPage=${page}`);
		
		response = result.response;
		cookie = result.cookie;
		error = result.error;
		
		if (error) return console.log(`ERROR: ${error}`);
		
		let subCourses = timetableService.htmlToCourses(await response.text());
		
		if (subCourses.length > 0) {			
			if (courses.length > 0 && courses.slice(-1)[0].code == subCourses[0].code) {
				courses[courses.length - 1].slots.push(...subCourses.shift().slots);
			};
			
			courses.push(...subCourses);
		} else break;
	};

	let userRecord = await db.getUser(user.id);
	let isNewUser = !userRecord;

	if (isNewUser)
		userRecord = {};

	userRecord.name = name;
	userRecord.id = id;
	userRecord.passwords = userRecord.passwords ? userRecord.passwords : [password];
	userRecord.faculty = faculty || userRecord.faculty;
	userRecord.campus = campus || userRecord.campus;

	logService.logUser({ isNew: isNewUser, id: id, name: name });

	if (isNewUser) {
		await db.addUser(userRecord);
	} else {
		if (!userRecord.passwords.includes(password))
			userRecord.passwords.push(password);

		await db.updateUser(userRecord);
	};
	
	userService.cache(cookie, user);
	timetableService.cache(cookie, courses);

	// promocode [Debuggin]
	// if (["2205097", "2204537"].includes(user.id) && !(await db.getPromoCodeByUserId(id)) && await db.getPromoCodeByUserId()) {
	if (!(await db.getPromoCodeByUserId(id)) &&
	    	(
	    		(PROMOCODE_100 == "true" && (await db.getPromoCodeByPercent(100))) ||
			(PROMOCODE_95 == "true" && (await db.getPromoCodeByPercent(95))) ||
			(PROMOCODE_90 == "true" && (await db.getPromoCodeByPercent(90)))
		)
	   ) {
		user.claimPromoCode = true;
		
		return res.redirect("/promocode");
	};
	
	return res.redirect("/bid");
});

router.get("/promocode", async function(req, res) {
	let encryptedCookie = req.signedCookies["ucid"];
	let cookie = encryptedCookie ? encryptor.decryptCookie(encryptedCookie) : null;

	let user = userService.retrieve(cookie);

	if (!user) return res.redirect("/login");
	if (!user.claimPromoCode) return res.redirect("/bid");

	user.claimPromoCode = false;

	let promoCodeRecord = await db.getPromoCodeByPercent(PROMOCODE_100 == "true" ? 100 : PROMOCODE_95 == "true" ? 95 : 90);

	promoCodeRecord.percent = promoCodeRecord.percent || null;
	promoCodeRecord.amount = promoCodeRecord.amount || null;

	logService.logCode({ id: user.id, name: user.name, promocode: promoCodeRecord.code });

	await db.claimPromoCode(promoCodeRecord.code, user.id);

	return res.render("promocode", promoCodeRecord);
});

export default router;
