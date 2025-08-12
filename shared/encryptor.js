function encryptCookie(plainText) {
	let charCodes = plainText.split("").map(char => char.charCodeAt(0));
	let startCode = Math.min(...charCodes);
	let endCode = Math.max(...charCodes);
    
	let cipherText = String.fromCharCode(
		...charCodes.map((charCode, index) => Math.abs(charCode - endCode) + startCode + (index % 2))
	);
	
	return cipherText;
};

function decryptCookie(cipherText) {
	let charCodes = cipherText.split("").map((char, index) => char.charCodeAt(0) - (index % 2));
	let startCode = Math.min(...charCodes);
	let endCode = Math.max(...charCodes);

	let plainText = String.fromCharCode(
		...charCodes.map(charCode => Math.abs(charCode - endCode) + startCode)
	);

	return plainText;
};

export default {
	encryptCookie,
	decryptCookie
};
