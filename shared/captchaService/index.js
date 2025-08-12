import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cachePath = `${__dirname}/cache`;

function downloadImage(cookie, response) {
	return new Promise((resolve, reject) => {
		let writeStream = response.body.pipe(fs.createWriteStream(`${cachePath}/${cookie}.jpg`, { flags: "w" }));
		
		writeStream
			.on("finish", () => resolve({ success: true }))
			.on("error", err => resolve({ error: err }));
	});
}

function deleteImage(cookie) {
	return fs.unlink(`${cachePath}/${cookie}.jpg`, function(err) {
		new Error(err);
	});
}

function getImagePath(cookie) {
	return `${cachePath}/${cookie}.jpg`;
}

export default {
	downloadImage,
	deleteImage,
	getImagePath
};
