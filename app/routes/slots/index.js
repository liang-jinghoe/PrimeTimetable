import express from "express";
const router = express.Router();

import db from "../../../db/index.js";

import forwardRequest from "../../../shared/forwardRequest.js";
import captchaService from "../../../shared/captchaService/index.js";
import timetableService from "../../../shared/timetableService.js";
import userService from "../../../shared/userService.js";
import encryptor from "../../../shared/encryptor.js";

router.get("/slots", async function(req, res) {
	let { response, cookie, error } = await forwardRequest(req, res, "https://unitreg.utar.edu.my/portal/courseRegStu/schedule/masterScheduleSurvey.jsp");
	if (error) return res.send(`ERROR: ${error}`);

	let html = await response.text();
	
	return res.send(html);
});

router.get("/courseReg", async function(req, res) {
	let { response, cookie, error } = await forwardRequest(req, res, "https://unitreg.utar.edu.my/portal/courseRegStu/registration/registerUnitSurvey.jsp");
	if (error) return res.send(`ERROR: ${error}`);

	let html = await response.text();
	
	return res.send(html);
});

router.get("/notAvailable", async function(req, res) {
	return res.sendFile(`${__dirname}/notAvailable.html`);
});

router.get("/test", async function(req, res) {
	let encryptedCookie = req.signedCookies["ucid"];
	let oldCookie = encryptedCookie ? encryptor.decryptCookie(encryptedCookie) : null;

	let user = userService.retrieve(oldCookie);
	let code = "MPU3153";

	if (!user) return res.redirect("/login");
	
	let { response, cookie, error } = await forwardRequest(req, res, "https://unitreg.utar.edu.my/portal/courseRegStu/registration/registerUnitSurvey.jsp", {
		body: `reqPaperType=M&reqFregkey=${user.id}&reqUnit=${code}&Save=View`,
		method: "POST"
	});
	
	if (error) return res.send(`ERROR: ${error}`);

	let html = await response.text();

	return res.send(html);
});

router.get("/addSlot", async function(req, res) {
	let encryptedCookie = req.signedCookies["ucid"];
	let oldCookie = encryptedCookie ? encryptor.decryptCookie(encryptedCookie) : null;

	let user = userService.retrieve(oldCookie);
	let code = "MPU3153";

	if (!user) return res.redirect("/login");
	
	let { response, cookie, error } = await forwardRequest(req, res, "https://unitreg.utar.edu.my/portal/courseRegStu/registration/registerUnitProSurvey.jsp", {
		body: `reqUnit=${code}&reqSid=17991&reqSession=202310&reqFregkey=${user.id}&reqPaperType=M&reqWithClass=Y&act=insert&reqMid=620030`,
		method: "POST"
	});
	
	if (error) return res.send(`ERROR: ${error}`);

	let html = await response.text();

	return res.send(html);
});

let users = [];
let paid = true;

router.post("/admin/refresh", async function(req, res) {
	let adminCookie = req.signedCookies["utartimetable"];

	if (!adminCookie || adminCookie != "secret password for utartimetable") return res.redirect("/login");

	users = await db.getSlots({ "payment.paid": paid });

	return res.redirect("/admin/keyin");
});

router.post("/admin/update", async function(req, res) {
	let adminCookie = req.signedCookies["utartimetable"];

	if (!adminCookie || adminCookie != "secret password for utartimetable") return res.redirect("/login");

	for (let user of users.filter(user => user.loggedIn)) {
		let { response, cookie, error } = await forwardRequest(req, res, "https://unitreg.utar.edu.my/portal/courseRegStu/schedule/masterScheduleSurvey.jsp", {
			headers: {
				cookie: user.cookie
			}
		});
		if (error) return res.send(`ERROR: ${error}`);

		let html = await response.text();
		let welcomeMsg = html.match(/Welcome, ([^\n\r]+) \([0-9]{2}[A-Z]+[0-9]{4,}\)/);

		user.name = welcomeMsg ? welcomeMsg[1] : "";

		if (user.name) {
			user.loggedIn = true;
			user.loginError = "";
		} else {
			user.loggedIn = false;
			
			if (!!response.url.match(/loginerror/i)) {
				user.loginError = "Wrong Id/Password";
			} else if (!!response.url.match(/invalidsecurity/i)) {
				user.loginError = "Failed Captcha";
			} else if (html.match(/<script[^\n\r]*>[^\n\r]*sessionExpiredSurvey[^\n\r]*<\/script>/i)) {
				user.loginError = "Expired";
			} else {
				user.loginError = "Unknown";
	
				console.log(response.url);
				console.log(html);
			};
		};
		
		user.cookie = cookie;
	};

	return res.redirect("/admin/keyin");
});

router.get("/admin/keyin", async function(req, res) {
	let adminCookie = req.signedCookies["utartimetable"];

	if (!adminCookie || adminCookie != "secret password for utartimetable") return res.redirect("/login");

	users.sort((userA, userB) => {
		if (userA.selected && !userB.selected) return -1;
		if (!userA.selected && userB.selected) return 1;
		if (userA.loginError && !userB.loginError) return -1;
		if (!userA.loginError && userB.loginError) return 1;
		if (userA.loggedIn && !userB.loggedIn) return -1;
		if (!userA.loggedIn && userB.loggedIn) return 1;
		if ((userA.time && userB.time && userA.time > userB.time) || !userA.time) return -1;
		if ((userA.time && userB.time && userA.time < userB.time) || !userB.time) return 1;
		if (!userA.courses[0].hasOwnProperty("status") && userB.courses[0].hasOwnProperty("status")) return -1;
		if (userA.courses[0].hasOwnProperty("status") && !userB.courses[0].hasOwnProperty("status")) return 1;
		if (userA._id > userB._id) return -1;
		if (userA._id < userB._id) return 1;

		return 0;
	});

	return res.render("slotsLists", {
		users: users,
		paid: paid
	});
	// return res.sendFile(`${__dirname}/admin.html`);
});

router.post("/admin/toggle", async function(req, res) {
	let adminCookie = req.signedCookies["utartimetable"];

	if (!adminCookie || adminCookie != "secret password for utartimetable") return res.redirect("/login");

	paid = !paid;

	users = await db.getSlots({ "payment.paid": paid });

	return res.redirect("/admin/keyin");
});

router.get("/admin/view", async function(req, res) {
	let adminCookie = req.signedCookies["utartimetable"];

	if (!adminCookie || adminCookie != "secret password for utartimetable") return res.redirect("/login");
	
	let objectid = req.query.objectid;

	let user = users.find(user => user._id.toString() == objectid);

	if (!user) return res.redirect("/admin/keyin");

	return res.render("view", {
		user: user
	});
});

router.post("/admin/keyin", async function(req, res) {
	let adminCookie = req.signedCookies["utartimetable"];

	if (!adminCookie || adminCookie != "secret password for utartimetable") return res.redirect("/login");

	let { _ids } = req.body;

	if (typeof _ids != "object") _ids = [_ids];

	let ids = users.filter(user => _ids.includes(user._id.toString())).map(user => user.id);
	let usersInfo = await db.getUsers({ id: { $in: ids } });

	users = users.map(user => {
		let userInfo = usersInfo.find(userInfo => userInfo.id == user.id);
		
		user.selected = _ids.includes(user._id.toString());

		if (userInfo)
			user.passwords = userInfo.passwords;

		return user;
	});

	return res.redirect("/admin/captcha");
	
	// let { data } = req.body;

	// for (let user of users) {
	// 	if (user.cookie) captchaService.deleteImage(user.cookie);
	// };

	// users = data
	// 	.replaceAll("\r\n", "\n")
	// 	.split(/\n\n/)
	// 	.map(userInfo =>  {
	// 		let rows = userInfo.split(/\n/);

	// 		let id = rows.shift();
	// 		let password = rows.shift();

	// 		let courses = rows
	// 			.map(courseText => {
	// 				let columns = courseText.split(/\s/);

	// 				let code = columns.shift();
	// 				let slots = columns.
	// 					map(slotText => {
	// 						let type = slotText.match(/[A-Z]+/i).toString();
	// 						let group = slotText.match(/[0-9]+/).toString();

	// 						return {
	// 							type: type,
	// 							group: group
	// 						};
	// 					});

	// 				return {
	// 					code: code,
	// 					slots: slots
	// 				};
	// 			});

	// 		return {
	// 			id: id,
	// 			password: password,
	// 			courses: courses
	// 		};
	// 	});

	// return res.redirect("/admin/captcha");
});

router.get("/admin/captcha", async function(req, res) {
	for (let user of users.filter(user => user.selected)) {
		if (!user.cookie || !user.loggedIn) {
			let { response, cookie, error } = await forwardRequest(req, res, "https://unitreg.utar.edu.my/portal/Kaptcha.jpg", {
				headers: {
					cookie: user.cookie || null
				}
			});
			if (error) return res.send(`ERROR: ${error}`);
			
			let result = await captchaService.downloadImage(cookie, response);
			if (result.error) return res.send(`DOWNLOAD ERROR: ${result}`);
			
			user.cookie = cookie;
		};
	};

	return res.render("adminCaptcha", {
		users: users
	});
});

router.get("/admin/test", async function(req, res) {
	return res.send(JSON.stringify(users));
});

router.post("/admin/captcha", async function(req, res, next) {
	let fields = req.body;
	let autoBid_Ids = [];

	for (let user of users.filter(user => user.selected)) {
		if (!user.loggedIn) {			
			let { response, cookie, error } = await forwardRequest(req, res, "https://unitreg.utar.edu.my/portal/courseRegStu/loginProSurvey.jsp", {
				headers: {
					cookie: user.cookie
				},
				body: `reqFregkey=${user.id}&reqPassword=${user.passwords[user.passwords.length - 1]}&kaptchafield=${fields["captcha_" + user.id]}`,
				method: "POST",
			});
			if (error) return res.send(`ERROR: ${error}`);

			let html = await response.text();
			let welcomeMsg = html.match(/Welcome, ([^\n\r]+) \([0-9]{2}[A-Z]+[0-9]{4,}\)/);
	
			user.name = welcomeMsg ? welcomeMsg[1] : "";
	
			if (user.name) {
				user.loggedIn = true;
				user.loginError = "";

				if (fields["autobid_" + user.id]) {
					autoBid_Ids.push(user._id.toString());
				}
			} else {
				user.loggedIn = false;
				
				if (!!response.url.match(/loginerror/i)) {
					user.loginError = "Wrong Id/Password";
				} else if (!!response.url.match(/invalidsecurity/i)) {
					user.loginError = "Failed Captcha";
				} else if (html.match(/<script[^\n\r]*>[^\n\r]*sessionExpiredSurvey[^\n\r]*<\/script>/i)) {
					user.loginError = "Expired";
				} else {
					user.loginError = "Unknown";
		
					console.log(response.url);
					console.log(html);
				};
			};
			
			user.cookie = cookie;
		};
	};

	if (autoBid_Ids.length > 0) {
		req.url = "/admin/bid";
		req.method = "POST";
		req.body = { _ids: autoBid_Ids };
		next();

		return;
	}

	return res.redirect("/admin/captcha");
});

router.post("/admin/bid", async function(req, res) {
	let adminCookie = req.signedCookies["utartimetable"];

	if (!adminCookie || adminCookie != "secret password for utartimetable") return res.redirect("/login");

	let { _ids } = req.body;

	if (typeof _ids != "object") _ids = [_ids];

	let selectedUsers;

	if (!!_ids[0])
		selectedUsers = users.filter(user => _ids.includes(user._id.toString()));
	else
		selectedUsers = users.filter(user => user.loggedIn);
	
	let usersLeft = selectedUsers.length;
	let slotsToBeUpdated = [];

	let startTime = new Date().getTime();
	
	for (let user of selectedUsers) {
		let timeRecords = {
			[user._id]: new Date().getTime().toString()
		};
		
		new Promise(async (resolve, reject) => {
			let coursesLeft = user.courses.length;
			
			for (let course of user.courses) {
				timeRecords[course.code] = new Date().getTime().toString();
				
				new Promise(async (resolve, reject) => {
					if (course.status == "Succeed") {
						return resolve();
					}
					
					let attempts = 0;
					let result, html, alertMsg, courses;
					
					while (attempts < 15) {						
						attempts += 1;

						if (attempts > 1)
							await new Promise((resolve, reject) => setTimeout(resolve, 500));
						
						result = await forwardRequest(req, res, "https://unitreg.utar.edu.my/portal/courseRegStu/registration/registerUnitSurvey.jsp", {
							headers: {
								cookie: user.cookie
							},
							body: `reqPaperType=M&reqFregkey=${user.id}&reqUnit=${course.code}&Save=View`,
							method: "POST",
						});
		
						if (result.error)
							continue;

						html = await result.response.text();
						alertMsg = html.match(/(?<=<\s*?script\s*?.*?\s*?>\s*?alert\s*?\(\s*?['"]\s*?).+(?=\s*?['"]\s*?\)\s*?<\s*?\/\s*?script\s*?>)/i);

						if (alertMsg)
							break;

						if (!result.response.url.match(/registerUnitSurvey/i))
							continue;

						courses = timetableService.htmlToCourses(html);

						if (courses.length > 0)
							break;
					};

					if (attempts > 1)
						timeRecords[course.code] += ` > ${new Date().getTime().toString()} [${attempts}] (${new Date().getTime() - startTime})`

					if (result.error) {
						course.status = "Error";
						course.error = result.error;

						return resolve();
					};
					
					if (alertMsg) {
						course.status = "Failed";
						course.error = alertMsg.toString();

						return resolve();
					};

					if (!result.response.url.match(/registerUnitSurvey/i)) {
						course.status = "Failed";
						course.error = "Redirected";

						return resolve();
					};
					
					if (courses.length == 0) {
						course.status = "Failed";
						course.error = "Course does not exist";

						return resolve();
					};

					course.valid = true;
					
					let formBody = timetableService.htmlToFormBody(html);
					let slots = courses[0].slots;
	
					for (let slot of course.slots) {
						let matchedSlot = slots.find(slt => slt.type == slot.type && slt.group == slot.group);
	
						if (matchedSlot) {
							slot.valid = true;
							slot.id = matchedSlot.id;
						};
					};

					if (course.slots.find(slot => !slot.valid)) {
						course.status = "Failed";
						course.error = "Slot does not exist";

						return resolve();
					};
					
					if (course.slots.find(slot => !slot.id)) {
						course.status = "Failed";
						course.error = "Slot possibily fulled";

						return resolve();
					};
					
					let body = Object.entries(formBody).map(keyValue => keyValue.join("=")).join("&") + course.slots.map(slot => `&reqMid=${slot.id}`).join("");
					
					result = await forwardRequest(req, res, "https://unitreg.utar.edu.my/portal/courseRegStu/registration/registerUnitProSurvey.jsp", {
						headers: {
							cookie: user.cookie
						},
						body: body,
						method: "POST",
					});

					if (result.error) {
						course.status = "Error";
						course.error = result.error;

						return reject();
					};
					
					html = await result.response.text();
					alertMsg = html.match(/(?<=<\s*?script\s*?.*?\s*?>\s*?alert\s*?\(\s*?['"]\s*?).+(?=\s*?['"]\s*?\)\s*?<\s*?\/\s*?script\s*?>)/i);
	
					if (alertMsg) {
						course.status = "Failed";
						course.error = alertMsg.toString();
					} else {
						course.status = "Succeed";
						course.error = "";
					};

					return resolve();
				})
					.catch(err => {
						course.status = "Error";
						course.error = err;
						
						console.log(err);
					})
					.finally(() => {						
						coursesLeft -= 1;

						timeRecords[course.code] += ` > ${new Date().getTime().toString()} (${new Date().getTime() - startTime})`;

						if (coursesLeft <= 0) {
							timeRecords[user._id] += ` > ${new Date().getTime().toString()} (${new Date().getTime() - startTime})`;
							console.log(timeRecords);
							
							slotsToBeUpdated.push({
								_id: user._id,
								id: user.id,
								courses: user.courses
							});
				
							resolve();
						};
					});
			};
		}).finally(async () => {			
			usersLeft -= 1;

			if (usersLeft <= 0) {
				console.log(`Overall: ${startTime} > ${new Date().getTime()} (${new Date().getTime() - startTime})`);
				
				db.updateManySlots(slotsToBeUpdated);
				
				return res.redirect("/admin/keyin");
			};
		});
	};
});

router.get("/testGet", async function(req, res) {
	return res.send(JSON.stringify(req.query));
});

router.get("/testDb", async function(req, res) {
	db.test();
});

// router.post("/login", async function(req, res) {
// 	let { id, password, captcha } = req.body;
	
// 	let { response, cookie, error } = await forwardRequest(req, res, "https://unitreg.utar.edu.my/portal/courseRegStu/loginProSurvey.jsp", {
// 		body: `reqFregkey=${id}&reqPassword=${password}&kaptchafield=${captcha}`,
// 		method: "POST",
// 	});
// 	if (error) return res.send(`ERROR: ${error}`);
	
// 	if (!!response.url.match(/loginerror/i)) return res.redirect("/login"); // Wrong ID or Password
// 	if (!!response.url.match(/invalidsecurity/i)) return res.redirect("/login"); // Failed Captcha
	
// 	let user = { id: id, password: password };
// 	let courses = [];
	
// 	for (let page = 1; page > 0; page++) {
// 		let result = await forwardRequest(req, res, `https://unitreg.utar.edu.my/portal/courseRegStu/schedule/masterScheduleSurvey.jsp?reqCPage=${page}`);
		
// 		response = result.response;
// 		cookie = result.cookie;
// 		error = result.error;
		
// 		if (error) return res.send(`ERROR: ${error}`);
		
// 		let subCourses = timetableService.htmlToCourses(await response.text());
		
// 		if (subCourses.length > 0) {			
// 			if (courses.length > 0 && courses.slice(-1)[0].code == subCourses[0].code) {
// 				courses[courses.length - 1].slots.push(...subCourses.shift().slots);
// 			};
			
// 			courses.push(...subCourses);
// 		} else break;
// 	};
	
// 	userService.cache(cookie, user);
// 	timetableService.cache(cookie, courses);
	
// 	return res.redirect("/bid");
// });

export default router;
