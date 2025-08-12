import express from "express";
const router = express.Router();

import db from "../../../db/index.js";

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import timetableService from "../../../shared/timetableService.js";
import userService from "../../../shared/userService.js";
import encryptor from "../../../shared/encryptor.js";

router.get("/bid", async function(req, res) {
	let encryptedCookie = req.signedCookies["ucid"];
	let cookie = encryptedCookie ? encryptor.decryptCookie(encryptedCookie) : null;

	let user = userService.retrieve(cookie);
	let courses = timetableService.retrieve(cookie);
	let headers = timetableService.getHeaderNames();

	if (!courses) return res.redirect("/login");

	if (user.payment.paid) return res.redirect("/logout");

	let courseCodes = courses.map(course => course.code);
	let slotsLists = await db.getSlots({ $and: [
		{ "courses.code": { $in: courseCodes } },
		{ "courses.status": { $exists: false } }
	]});
	let slots = slotsLists.reduce((accumulator, slotsInfo) => {
		let slots = slotsInfo.courses.reduce((accumulator, course) => {
			return [ ...accumulator, ...course.slots.map(slot => {
				slot.code = course.code;

				return slot;
			}) ];
		}, []);

		return [ ...accumulator, ...slots ];
	}, []);

	for (let course of courses) {
		for (let slot of course.slots) {
			let numOfRegistered = slots.filter(slt => slt.code == course.code && slt.type == slot.type && slt.group == slot.group).length;

			if (!['2205097', "2207102"].includes(user.id) && numOfRegistered >= parseInt(slot.size) / 3) {
				slot.closed = true;
			};
		};
	};
	
	return res.render("bid", {
		headers: headers,
		courses: courses,
		message: ""
	});
});

router.get("/bid/main.js", function(req, res) {
	return res.sendFile(`${__dirname}/main.js`);
});

router.post("/bid", function(req, res) {
	let encryptedCookie = req.signedCookies["ucid"];
	let cookie = encryptedCookie ? encryptor.decryptCookie(encryptedCookie) : null;
	
	let user = userService.retrieve(cookie);
	let courses = timetableService.retrieve(cookie);
	let headers = timetableService.getHeaderNames();
	
	if (!user) return res.send("Invalid user");
	if (!courses) return res.send("Timetable not found");

	// In maintenance mode for a while
	if (false && !["2205097"].includes(user.id)) return res.render("bid", { // Debugging
		headers: headers,
		courses: courses,
		message: "System will open soon"
	})
	
	let slotsValue = req.body.slots;
	
	if (!slotsValue) return res.render("bid", {
		headers: headers,
		courses: courses,
		message: "Please select at least one slot"
	});
	if (!slotsValue.match(/^(\w{3,4}\d{4}-[LTP]-\d+)(,\w{3,4}\d{4}-[LTP]-\d+){0,}$/i)) return res.send(`Incorrect format:\n${slotsValue}`);
	
	let slots = slotsValue
		.split(",")
		.map(slot => {
			let [ code, type, group ] = slot.split("-");
			
			return { code: code, type: type, group: group };
		})
		.sort((slotA, slotB) => {
			if (slotA.code < slotB.code) return -1;
			if (slotA.code > slotB.code) return 1;
			if (slotA.type < slotB.type) return -1;

			return 0;
		});

	for (let slot of slots) {
		let course = courses.find(course => course.code == slot.code);

		if (!course) return res.send(`Unknown course:\n${slot.code}`);

		let selectedSlot = course.slots.find(slt => slt.type == slot.type && slt.group == slot.group);
		
		if (!selectedSlot) return res.send(`Unknown slot:\n${course.code} (${slot.type + slot.group})`);

		if (selectedSlot.closed) return res.send(`Slot not available:\n${course.code} (${slot.type + slot.group})`);
	};

	user.payment = {
		items: [],
		discounts: [],
		total: 0,
		promoCode: "",
		paid: false
	};
	
	user.slots = slots;
	
	return res.redirect("/payment");
});

router.get("/bid/download", function(req, res) {
	let encryptedCookie = req.signedCookies["ucid"];
	let cookie = encryptedCookie ? encryptor.decryptCookie(encryptedCookie) : null;
	
	let user = userService.retrieve(cookie);
	let courses = timetableService.retrieve(cookie);
	let headers = timetableService.getHeaderNames();
	
	if (!user) return res.send("Invalid user");
	if (user.selectedSlots.length == 0) return res.render("bid", {
		headers: headers,
		courses: courses,
		message: "No slot to download"
	});

	let filename = `PrimeTimetable_Slots_${new Date().toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).replaceAll('/', "")}_${user.id}.txt`;
	let path = `${__dirname}/${filename}`;
	let txt = user.selectedSlots.join(", ");

	try {
		fs.writeFileSync(path, txt);

		return res.download(path, filename);
	} catch(err) {
		return res.render("bid", {
			headers: headers,
			courses: courses,
			message: "Something went wrong"
		});
	}
});

router.post("/bid/add", function(req, res) {
	let encryptedCookie = req.signedCookies["ucid"];
	let cookie = encryptedCookie ? encryptor.decryptCookie(encryptedCookie) : null;
	
	let user = userService.retrieve(cookie);
	let courses = timetableService.retrieve(cookie);
	let headers = timetableService.getHeaderNames();
	
	if (!user) return res.send("Invalid user");
	if (!courses) return res.send("Timetable not found");

	let slotValue = req.body.slot;

	if (!slotValue.match(/^(\w{3,4}\d{4}-[LTP]-\d+)(,\w{3,4}\d{4}-[LTP]-\d+){0,}$/i)) return res.send(`Incorrect format:\n${slotValue}`);

	let [ code, type, group ] = slotValue.split("-");

	let course = courses.find(course => course.code == code);

	if (!course) return res.send(`Unknown course:\n${code}`);

	let selectedSlot = course.slots.find(slt => slt.type == type && slt.group == group);
		
	if (!selectedSlot) return res.send(`Unknown slot:\n${code} (${type + group})`);

	if (selectedSlot.closed) return res.send(`Slot not available:\n${code} (${type + group})`);

	user.selectedSlots.push(slotValue);

	return res.send("OK");
});

router.post("/bid/remove", function(req, res) {
	let encryptedCookie = req.signedCookies["ucid"];
	let cookie = encryptedCookie ? encryptor.decryptCookie(encryptedCookie) : null;
	
	let user = userService.retrieve(cookie);
	let courses = timetableService.retrieve(cookie);
	let headers = timetableService.getHeaderNames();
	
	if (!user) return res.send("Invalid user");
	if (!courses) return res.send("Timetable not found");

	let slotValue = req.body.slot;

	let index = user.selectedSlots.indexOf(slotValue);

	if (index >= 0)
		user.selectedSlots.splice(index, 1);

	return res.send("OK");
});

router.get("/bid/get", function(req, res) {
	let encryptedCookie = req.signedCookies["ucid"];
	let cookie = encryptedCookie ? encryptor.decryptCookie(encryptedCookie) : null;
	
	let user = userService.retrieve(cookie);
	let courses = timetableService.retrieve(cookie);
	let headers = timetableService.getHeaderNames();
	
	if (!user) return res.send("Invalid user");
	if (!courses) return res.send("Timetable not found");

	return res.send(user.selectedSlots);
});

export default router;
