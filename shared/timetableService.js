const divRegex = /<div id=['"]overviewSector['"].*?>.+?<\/div>/is;
const rowsRegex = /<tr.*?>.+?<\/tr>/igs;
const headersRegex = /<td.*?class.*?=.*?(['"]).*?header.*?\1.*?>.*?<.*?>/igs;
const cellsRegex = /<td.*?>.*?<\/td.*?>/igs;
const valueRegex = /(?<=<td.*?>)((.|<|>)+|(.|<|>)*)(?=<.*?>)/is;
const inputsRegex = /<\s*?input.*?type.*?=.*?"hidden".*?name.*?=.*?"\w+".*?value.*?=.*?"\w+".*?>/ig;
const attrRegex = /\w*?="\w*?"/ig;
const valueAttrRegex = /(?<=value.*?=.*?").*?(?=")/i;
const nameAttrRegex = /(?<=name.*?=.*?").*?(?=")/i;

export const headerNames = ["type", "group", "size", "day", "time", "hour", "week", "room", "tutor", "remark"];
export const cachedContents = {};

function cache(key, content) {
	cachedContents[key] = content;
};

function retrieve(key) {		
	return cachedContents[key];
};

function getHeaderNames() {
	return headerNames;
};

function htmlToFormBody(html) {
	let htmlInputs = html.match(inputsRegex); // gets all the input elements

	let inputs = htmlInputs // only gets inputs with name and value attributes
		.map(htmlInput => htmlInput
			.match(attrRegex)
			.filter(attribute => attribute.match(/(name|value)/))) // keeps name and value attributes
		.filter(attributes => attributes.length == 2);

	// converts strings of key and value to key-pair value in object
	let formBody = inputs.reduce((accumulator, attributes) => {
		let key = attributes.find(attribute => attribute.match(nameAttrRegex)).match(nameAttrRegex).toString();
		let value = attributes.find(attribute => attribute.match(valueAttrRegex)).match(valueAttrRegex).toString();

		return { ...accumulator, [key]: value };
	}, {});

	return formBody;
};

function htmlToCourses(html) {
	let htmlDiv = html.match(divRegex); // gets all the div elements
	
	if (!htmlDiv) return [];
	
	let htmlRows = htmlDiv[0]
		.match(rowsRegex)
		.filter(htmlRow => !!(htmlRow.match(headersRegex) || htmlRow.match(cellsRegex))); // gets the headers and rows
	let htmlHeaders = htmlRows.splice(htmlRows.findIndex(htmlRow => htmlRow.match(headersRegex).length > 1), 1)[0];
		
	let headerCells = htmlHeaders
		.match(headersRegex)
		.map(htmlHeader => htmlHeader.match(valueRegex)[0]); // extracts the td htmls to the string value
	let headers = headerNames
		.reduce((accumulator, value) => ({ ...accumulator, [value]: headerCells.findIndex(header => !!header.match(new RegExp(value, "i"))) }), {}); // relocates the cell index for each header

	let rows = [];
	for (let [index, htmlRow] of htmlRows.entries()) {
		let numOfHeaders = (htmlRow.match(headersRegex) || []).length;
		let htmlCells = htmlRow.match(cellsRegex) || htmlRow.match(/<td.*?>.*?<\/.*?>/igs);
		let numOfCells = htmlCells.length;
		let cells = htmlCells.map(htmlCell => htmlCell.match(valueRegex)[0]);
		
		if (numOfHeaders == numOfCells) // new course
			rows.push({
				code: cells[0].match(/\w{3,4}\d{4}/i)[0],
				name: cells[0].match(/(?<=\w{3,4}\d{4}[\s-]+\s).+?(?=([\s]*\[(\d|\.)+\])|$)/i)[0],
				credit_hours: (cells[0].match(/(?<=\[)[\d\.]+(?=\])/i) || "").toString(),
				slots: []
			});
		
		else if (numOfCells == headerCells.length) // new slot
			rows.push(
				Object.entries(headers) // uses headers as template to generate a slot object
					.reduce((accumulator, [header, index]) => {
						if (["type", "group", "size", "remark"].includes(header)) // values of these headers are generalized under slot object rather than inside each individual classes
							return { ...accumulator, [header]: cells[index] };

						accumulator.classes[0][header] = cells[index]; // remanining values are stored under class
						
						return accumulator;
					}, {
						classes: [{}],
						id: headerCells[headerCells.length - 1] == "" ? (cells[cells.length - 1].match(valueAttrRegex) || "").toString() : null
					})
			);
		
		else if (htmlRow.match(/<tr.*?id=['"].*?subrow.*?['"].*?>/is)) // sub classes for previous slot
			rows.push(
				cells.reduce((accumulator, cell) => ( // converts the cells array to object with key-pair value
					{
						...accumulator,
						[ // gets the keys of class from previous slot
							Object.keys(rows.findLast(row => !!row.classes).classes[0]).find(key => !!rows.findLast(row => !!row.classes).classes[0][key].match(new RegExp(
								`^${
									cell
									.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&")
									.replace(/[a-z]/g, "[a-z]")
									.replace(/[A-Z]/g, "[A-Z]")
									.replace(/[0-9]/g, "[0-9]")
								}$`
							))) || "week"
						]: cell
					}
				), {})
			);
		else
			rows.push({});
	};
	
	let courses = [];
	for (let i = 0; i < rows.length + i; i++) {
		let row = rows.shift();
		
		if (row.code)
			courses.push(row);
		if (row.type)
			courses[courses.length - 1].slots.push(row);
		if (row.room)
			courses[courses.length - 1].slots[courses[courses.length - 1].slots.length - 1].classes.push(row);
	};
	
	return courses;
};

export default {
	cache,
	retrieve,
	htmlToFormBody,
	htmlToCourses,
	getHeaderNames
};
