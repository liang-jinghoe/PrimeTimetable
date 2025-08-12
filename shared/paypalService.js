import fetch from "node-fetch";

const { CLIENT_ID, APP_SECRET } = process.env;
const base = "https://api-m.sandbox.paypal.com";

async function handleResponse(response) {
	if (response.status === 200 || response.status === 201) {
		// console.log("Good");
		// console.log(response);
		
		return response.json();
	}
	
	let errorMessage = await response.text();
	
	console.log(errorMessage);
	
	throw new Error(errorMessage);
};

async function generateAccessToken() {
	let auth = Buffer.from(CLIENT_ID + ":" + APP_SECRET).toString("base64");
	
	let response = await fetch(`${base}/v1/oauth2/token`, {
		method: "post",
		body: "grant_type=client_credentials",
		headers: {
			Authorization: `Basic ${auth}`
		}
	});
	
	let jsonData = await handleResponse(response);
	
	return jsonData.access_token;
};

async function createOrder(user) {
	let payment = user.payment;
	let netTotal = Math.max(0, payment.netTotal);
	let totalDiscount = payment.discounts.reduce((accumulator, discount) => accumulator + (discount.percent ? user.payment.total * discount.percent / 100 : discount.amount), 0);
	
	let accessToken = await generateAccessToken();
		
	let response = await fetch(`${base}/v2/checkout/orders`, {
		method: "post",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${accessToken}`
		},
		body: JSON.stringify({
			intent: "CAPTURE",
			purchase_units: [
				{
					amount: {
						currency_code: "MYR",
						value: netTotal.toFixed(2),
						breakdown: {
							item_total: {
								currency_code: "MYR",
								value: payment.total.toFixed(2)
							},
							discount: {
								currency_code: "MYR",
								value: Math.min(totalDiscount, payment.total).toFixed(2)
							}
						}
					},
					items: user.payment.items
				}
			]
		})
	});
	
	return handleResponse(response);
};

async function capturePayment(orderId) {
	// console.log("Order id: " + orderId);
	// console.log("Access Token");
	let accessToken = await generateAccessToken();
	
	// console.log("Response");
	let response = await fetch(`${base}/v2/checkout/orders/${orderId}/capture`, {
		method: "post",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${accessToken}`
		}
	});
	
	// console.log("Return handleResponse(response)");
	return handleResponse(response);
};

export default {
	createOrder,
	capturePayment
};
