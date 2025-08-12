import express from "express";
const router = express.Router();

import fs from "fs";

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const libPath = `${__dirname}/lib`;

const fileList = fs.readdirSync(libPath);

for (const file of fileList) {
	let filePath = `${libPath}/${file}`;
	
	router.get(`/images/${file}`, async function(req, res) {
		return res.sendFile(filePath);
	});
};

export default router;
