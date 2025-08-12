const { WEBHOOK_URL, RENDER_EXTERNAL_URL } = process.env;

function log(content) {
	return fetch(WEBHOOK_URL, {
		method: "POST",
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			content: content,
			username: "Nerdy"
		})
	})
}

function logSlot(paymentRecord) {
	return log(`:calendar_spiral: ${RENDER_EXTERNAL_URL}/admin/view?objectid=${paymentRecord.payment.id}`);
};

function logCode(claimRecord) {
	return log(`:ticket: **${claimRecord.promocode}** ${claimRecord.id} \`${claimRecord.name}\``);
};

function logUser(user) {
	return fetch(`${user.isNew ? ":new:" : ":inbox_tray:" } ${user.id} \`${user.name}\``);
};

export default {
	logSlot,
	logCode,
	logUser
};
