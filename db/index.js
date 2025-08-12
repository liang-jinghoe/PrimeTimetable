const { MONGODB_URL } = process.env;

import { MongoClient, ServerApiVersion } from 'mongodb';

const userCollection = "users";
const slotsCollection = "slots";
const paymentCollection = "payments";
const promoCodeCollection = "promocodes";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(MONGODB_URL, {
	serverApi: {
		version: ServerApiVersion.v1,
		strict: true,
		deprecationErrors: true,
	}
});

async function connect(collectionName, fn) {
	let result;
	
	try {
		await client.connect();

		let collection = client.db("slots_selections").collection(collectionName);

		result = await fn(collection);
	} finally {
		await client.close();
	}

	return result;
};

async function addUser(user) {
	return connect(userCollection, async (users) => {
		return await users.insertOne(user);
	});
};

async function getUser(id) {
	return connect(userCollection, async (users) => {
		return await users.findOne({ id: id });
	});
};

async function getUsers(query) {
	return connect(userCollection, async (users) => {
		return await users.find(query).toArray();
	});
};

async function updateUser(user) {
	return connect(userCollection, async (users) => {
		return await users.updateOne({ id: user.id }, { $set: user });
	});
};

async function addSlots(slotsInfo) {
	return connect(slotsCollection, async (slots) => {
		return await slots.insertOne(slotsInfo);
	});
};

async function getSlots(query) {
	return connect(slotsCollection, async (slots) => {
		return await slots.find(query).toArray();
	});
}

async function updateSlots(slotsInfo) {
	return connect(slotsCollection, async (slots) => {
		return await slots.updateOne({ _id: slotsInfo._id }, { $set: { courses: slotsInfo.courses } });
	});
};

async function updateManySlots(slotsInfos) {
	return connect(slotsCollection, async (slots) => {
		let results = [];

		await new Promise((resolve, reject) => {
			for (let i = 0; i < slotsInfos.length; i++) {
				let slotsInfo = slotsInfos[i];
				
				new Promise(async (resolve, reject) => {
					let result = await slots.updateOne({ _id: slotsInfo._id }, { $set: { courses: slotsInfo.courses } });

					resolve(result);
				})
					.then((result) => {
						results[i] = result;
					})
					.catch((err) => {
						results[i] = err;
					})
					.finally(() => {
						if (results.length == slotsInfos.length && results.findIndex(result => !!!result) == -1) {
							resolve();
						}
					});
				
			};
		});

		return results;
	});
};

async function addPayment(payment) {
	return connect(paymentCollection, async (payments) => {
		return await payments.insertOne(payment);
	});
};

async function getPromoCode(code) {
	return connect(promoCodeCollection, async (promocodes) => {
		return await promocodes.findOne({ code: code });
	});
};

async function getPromoCodeByUserId(id = null) {
	return connect(promoCodeCollection, async (promocodes) => {
		return await promocodes.findOne({ claimed_by: id, expiry_date: { $gte: new Date() } });
	});
};

async function getPromoCodeByPercent(percentage) {
	return connect(promoCodeCollection, async (promocodes) => {
		return await promocodes.findOne({ claimed_by: null, percent: percentage, expiry_date: { $gte: new Date() } });
	});
};

async function updatePromoCode(code, slots_id) {
	return connect(promoCodeCollection, async (promocodes) => {
		return await promocodes.updateOne({ code: code }, { $set: { slots_id: slots_id } });
	});
};

async function claimPromoCode(code, id) {
	return connect(promoCodeCollection, async (promocodes) => {
		return await promocodes.updateOne({ code: code }, { $set: { claimed_by: id } });
	});
};

// const DB_SETUP = require("../config/db-setup");

// const { Pool } = require("pg");

// const pool = new Pool({ process.env.INTERNAL_DATABASE_URL });

// pool.query(DB_SETUP, (err) => console.log(err));

// process.on("SIGTERM", function() {
// 	pool.end().then(() => console.log("PostgreSQL's Pool ended"));
// });

export default {
	getUser,
	getUsers,
	addUser,
	updateUser,
	addSlots,
	getSlots,
	updateSlots,
	updateManySlots,
	addPayment,
	getPromoCode,
	getPromoCodeByUserId,
	getPromoCodeByPercent,
	updatePromoCode,
	claimPromoCode
};
