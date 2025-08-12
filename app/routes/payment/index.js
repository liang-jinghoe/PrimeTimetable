const priceRates = {
	L: 0.5,
	P: 1.5,
	T: 1.5
};

import express from "express";
const router = express.Router();

import db from "../../../db/index.js";

import userService from "../../../shared/userService.js";
import timetableService from "../../../shared/timetableService.js";
import paypalService from "../../../shared/paypalService.js";
import encryptor from "../../../shared/encryptor.js";
import logService from "../../../shared/logService.js";

router.get("/payment", async function(req, res) {
	let encryptedCookie = req.signedCookies["ucid"];
	let cookie = encryptedCookie ? encryptor.decryptCookie(encryptedCookie) : null;
	
	let user = userService.retrieve(cookie);
	let courses = timetableService.retrieve(cookie);
	let slots = user.slots; 
	
	if (!slots) return res.redirect("/bid");

	if (user.payment.items.length == 0) {
		for (let course of courses) {
			let slotsByCourse = [];
			let priceByCourse = 0;
			
			for (let slot of course.slots) {
				if (slots.find(slt => slt.code == course.code && slt.type == slot.type && slt.group == slot.group)) {
					slotsByCourse.push(slot.type + slot.group);
					
					let weeks = [];
					let numbers = slot.classes[0].week.split(/[^\d]/).map(Number);
					let operators = slot.classes[0].week.match(/[^\d]/g);
				
					for (let i = 0; i < operators.length; i++) {
						weeks.push(numbers[i]);
				        
						if (operators[i] == '-')
							for (let j = numbers[i] + 1; j < numbers[i + 1]; j++)
								weeks.push(j);
					}
				
					weeks.push(numbers[numbers.length - 1]);
					
					let price = priceRates[slot.type] * weeks.length;
					
					priceByCourse += price;
				};
			};

			if (slotsByCourse.length > 0) {
				user.payment.items.push({
					name: course.code,
					unit_amount: {
						currency_code: "MYR",
						value: priceByCourse.toFixed(2),
					},
					quantity: "1",
					description: slotsByCourse.join(", ")
				});

				user.payment.total += priceByCourse;
			};
		};

		user.payment.netTotal = user.payment.total;
	};
	
	return res.render("payment", {
		courses: courses,
		slots: slots,
		payment: user.payment,
		promoCode: ""
	});
});

router.post("/payment", async function(req, res) {
	let encryptedCookie = req.signedCookies["ucid"];
	let cookie = encryptedCookie ? encryptor.decryptCookie(encryptedCookie) : null;
	
	let user = userService.retrieve(cookie);
	let courses = timetableService.retrieve(cookie);
	let slots = user.slots; 
	
	if (!slots) return res.redirect("/bid");

	let { promoCode } = req.body;

	let discountIdx = user.payment.discounts.findIndex(discount => discount.description == "Promo Code Discount");
	let discount = discountIdx > -1 ? user.payment.discounts[discountIdx] : null;

	if (discount && discount.code !== promoCode) {
		user.payment.discounts.splice(discountIdx, 1);
		user.payment.promoCode = "";
		user.payment.netTotal += discount.percent ? discount.percent / 100 * user.payment.total : discount.amount;
	};

	if (user.payment.promoCode != promoCode) {
		let promoCodeRecord = await db.getPromoCode(promoCode);
	
		if (promoCodeRecord && promoCodeRecord.claimed_by && !promoCodeRecord.slots_id && new Date() < new Date(promoCodeRecord.expiry_date)) {
			user.payment.discounts.push({
				description: "Promo Code Discount",
				code: promoCodeRecord.code,
				percent: promoCodeRecord.percent,
				amount: promoCodeRecord.amount
			});

			user.payment.promoCode = promoCode;
			user.payment.netTotal -= promoCodeRecord.percent ? promoCodeRecord.percent / 100 * user.payment.total : promoCodeRecord.amount;
		};
	};
	
	return res.render("payment", {
		courses: courses,
		slots: slots,
		payment: user.payment,
		promoCode: promoCode,
		id: user.id
	});
});

router.post("/payment/create-paypal-order", async function(req, res) {
	let encryptedCookie = req.signedCookies["ucid"];
	let cookie = encryptedCookie ? encryptor.decryptCookie(encryptedCookie) : null;
	
	let user = userService.retrieve(cookie);
	
	try {
		let order = await paypalService.createOrder(user);
		
		res.json(order);
	} catch(err) {
		console.log(err.message);
		
		res.status(500).send(err.message);
	};
});

// <script src="https://www.paypal.com/sdk/js?client-id=AclC2Fdzai31oqWoRH1iUDg9N8d1YeQGFL96AQEgzADqtwzXlgsqOLy7VDqibv54ReTmn3TM_XFJX9Xf&currency=MYR"></script>
// <div class="flex-child" id="paypal-button-container" style="margin: 0 auto;"></div>
// <script>
// 	paypal
// 		.Buttons({
// 			style: {
// 				layout: "horizontal",
// 				color: "blue",
// 				shape: "rect",
// 				label: "pay"
// 			},
// 			createOrder: function() {
// 				return fetch("/payment/create-paypal-order", {
// 					method: "post",
// 					headers: {
// 						"Content-Type": "application/json"
// 					},
// 					body: JSON.stringify({
// 						key: "value"
// 					}),
// 					credentials: "include"
// 				})
// 					.then(response => response.json())
// 					.then(order => order.id);
// 			},
// 			onApprove: function(data) {
// 				return fetch("/payment/capture-paypal-order", {
// 					method: "post",
// 					headers: {
// 						"Content-Type": "application/json"
// 					},
// 					body: JSON.stringify({
// 						orderID: data.orderID
// 					}),
// 					credentials: "include"
// 				})
// 					.then(response => response.json())
// 					.then(orderData => {
// 						console.log(
// 							"Capture result",
// 							orderData,
// 							JSON.stringify(orderData, null, 2)
// 						);
						
// 						let transaction = orderData.purchase_units[0].payments.captures[0];
						
// 						console.log(
// 							"Transaction " +
// 								transaction.status +
// 								": " +
// 								transaction.id +
// 								"\n\nSee console for all available details"
// 						);

// 						location.reload();
// 					});
// 			}
// 		})
// 		.render("#paypal-button-container");
// </script>

router.post("/payment/capture-paypal-order", async function(req, res) {
	let encryptedCookie = req.signedCookies["ucid"];
	let cookie = encryptedCookie ? encryptor.decryptCookie(encryptedCookie) : null;
	
	// let { orderID } = req.body;
	
	try {
		// let captureData = orderID ? await paypalService.capturePayment(orderID) : null;
		
		// TODO: store payment information such as the transaction ID
		let user = userService.retrieve(cookie);
		let courses = timetableService.retrieve(cookie);
		let slots = user.slots;
		let payment = user.payment;

		// if (payment.netTotal > 0 && !captureData) return res.send("Unauthorized request");

		let selectedCourses = [];

		for (let slot of slots) {
			let course = selectedCourses.find(course => course.code == slot.code);
			
			if (!course) {
				selectedCourses.push({ code: slot.code, slots: [] });

				course = selectedCourses[selectedCourses.length - 1];
			};
	
			// course.slots.push({ type: slot.type, group: slot.group });
			course.slots.push(courses.find(course => course.code == slot.code).slots.find(slt => slt.type == slot.type && slt.group == slot.group));
		};

		payment.paid = (payment.netTotal == 0);

		let paymentRecord = {
			id: user.id,
			courses: selectedCourses,
			payment: {
				actual_amount: payment.total,
				net_amount: payment.netTotal,
				paid: payment.paid
			}
		};

		if (user.time)
			paymentRecord.time = user.time;

		let { insertedId } = await db.addSlots(paymentRecord);

		// if (captureData) {
		// 	captureData.slots_id = insertedId;
			
		// 	await db.addPayment(captureData);
		// };
	
		if (payment.promoCode) await db.updatePromoCode(payment.promoCode, insertedId);

		payment.id = insertedId;
		paymentRecord.payment.id = insertedId;

		logService.logSlot(paymentRecord);

		return res.redirect("/payment");
	} catch(err) {
		res.status(500).send(err.message);
	};
});

export default router;
