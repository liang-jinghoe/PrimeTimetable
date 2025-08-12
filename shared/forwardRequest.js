const DEFAULT_OPTIONS = {
	headers: {
		"accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
		"accept-language": "en-US,en;q=0.9",
		"cache-control": "max-age=0",
		"content-type": "application/x-www-form-urlencoded",
		"sec-ch-ua": "\"Not_A Brand\";v=\"99\", \"Microsoft Edge\";v=\"109\", \"Chromium\";v=\"109\"",
		"sec-ch-ua-mobile": "?0",
		"sec-ch-ua-platform": "\"Windows\"",
		"sec-fetch-dest": "document",
		"sec-fetch-mode": "navigate",
		"sec-fetch-site": "same-origin",
		"sec-fetch-user": "?1",
		"upgrade-insecure-requests": "1"
	},
	referrerPolicy: "strict-origin-when-cross-origin",
	mode: "cors",
	agent: function(_parsedUrl) {
		return _parsedUrl.protocol == "http:" ? httpAgent : httpsAgent;
	},
	redirect: "manual"
};

import fetch from "node-fetch";
import dns from "node:dns";
import http from "http";
import https from "https";
import fs from "fs";
import CacheableLookup from 'cacheable-lookup';

const cacheable = new CacheableLookup();

import encryptor from "./encryptor.js";

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const options = {
	ca: fs.readFileSync(`${__dirname}/../config/ca-cert.pem`),
	lookup: cacheable.lookup
};

//cacheable.install(http.globalAgent);
//cacheable.install(https.globalAgent);

const httpAgent = new http.Agent(options);
const httpsAgent = new https.Agent(options);

function formatObject(object, format) {
	let softcopy = Object.assign({}, object);
	
	for (let [key, value] of Object.entries(format)) {
		if (value != null && typeof value == "object" && typeof softcopy[key] == "object") // value is an inner object
			softcopy[key] = formatObject(softcopy[key], format[key]);
		else if (!softcopy.hasOwnProperty(key)) // sets default primitive value
			softcopy[key] = value;
	};
	
	return softcopy;
}

function forwardRequest(req, res, url, options = {}, normal) {
	let customCookie = typeof options.headers == "object" && options.headers.hasOwnProperty("cookie") ? options.headers.cookie : undefined;
	let encryptedCookie = req.signedCookies["ucid"];
	let cookie = encryptedCookie ? encryptor.decryptCookie(encryptedCookie) : null;
	
	options = formatObject(options, DEFAULT_OPTIONS);
	
	if (customCookie === undefined) options.headers.cookie = cookie;

	return fetch(url, options).then(response => {
		let newCookie = response.headers.get("set-cookie");
		newCookie = newCookie ? newCookie.split(/;\s/)[0] : null;
				
		if (customCookie === undefined && newCookie && newCookie !== options.headers.cookie) // constantly update the cookie retrieved from url as new cookie
			res.cookie("ucid", encryptor.encryptCookie(newCookie), {
				secure: true,
				httpOnly: true,
				signed: true
			});

		let requestUrl = response.url;
		let redirectUrl = response.headers.get("location");

		if (redirectUrl) {
			if (!redirectUrl.match(/^http/i))
				redirectUrl = requestUrl.substring(0, requestUrl.lastIndexOf('/')) + "/" + redirectUrl;

			let forwardOptions = {
				headers: {
					cookie: newCookie || customCookie
				}
			};

			if (customCookie === undefined && !newCookie)
				forwardOptions = {};

			return forwardRequest(req, res, redirectUrl, forwardOptions);
		};
		
		return {
			response: response,
			cookie: newCookie || customCookie || cookie,
		};
	}).catch(err => ({ error: err }));
};

export default forwardRequest;
