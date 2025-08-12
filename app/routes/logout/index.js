import express from "express";
const router = express.Router();

import forwardRequest from "../../../shared/forwardRequest.js";

router.get("/logout", async function(req, res) {
	let { response, cookie, error } = await forwardRequest(req, res, "https://unitreg.utar.edu.my/portal/courseRegStu/logoutBeforeSurvey.jsp");
		
	return res.redirect("/login");
});

export default router;
