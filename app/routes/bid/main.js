let slots = [];

function addClass(element, name) {
	if (!element.className.match(name))
		element.className += ` ${name}`;
};

function removeClass(element, name) {
	element.className = element.className.replace(` ${name}`, "");
};

function toHours(str) {
	let [start, end] = str.match(/\d{1,2}\s*?:\s*?\d\d\s*?[ap]m/ig);
	
	// clean
	let startMin = parseInt(start.match(/\d{2}(?=\s*?[ap]m)/i)[0]);
	let startHour = parseInt(start.match(/^\d{1,2}/)[0]) + startMin / 60;
	startHour += !!start.match(/pm/i) && startHour < 12 ? 12 : 0;
	let endMin = parseInt(end.match(/\d{2}(?=\s*?[ap]m)/i)[0]);
	let endHour = parseInt(end.match(/^\d{1,2}/)[0]) + endMin / 60;
	endHour += !!end.match(/pm/i) && endHour < 12 ? 12 : 0;
	
	return {
		start: startHour,
		end: endHour
	};
};

function toWeeks(str) {
	let weeks = [];
	let numbers = str.split(/[^\d]/).map(Number);
	let operators = str.match(/[^\d]/g) || [];

	for (let i = 0; i < operators.length; i++) {
		weeks.push(numbers[i]);
        
		if (operators[i] == '-')
			for (let j = numbers[i] + 1; j < numbers[i + 1]; j++)
				weeks.push(j);
	}

	weeks.push(numbers[numbers.length - 1]);

	return weeks;
};

function getSlotDetails(tbody, isPreview) {
	function getClassValue(element, key) {
		return Object.values(element.classList)
			.find(className => !!className.match(new RegExp(`${key}:`, "i")))
			.match(new RegExp(`(?<=${key}:).+$`, "is"))[0]
			.replace(/_/g, ' ');
	};

	let courseTbody = tbody;

	while (!courseTbody || !courseTbody.className.match(/course/i)) {
		courseTbody = courseTbody.previousElementSibling;
	};
	
	let slot = {
		code: getClassValue(tbody, "code"),
		type: getClassValue(tbody, "type"),
		group: getClassValue(tbody, "group"),
		color: courseTbody.style.background,
		classes: [],
		preview: isPreview
	};
	
	for (let tr of Object.values(tbody.rows)) {
		let cls = {
			day: getClassValue(tr, "day"),
			week: getClassValue(tr, "week"),
			room: getClassValue(tr, "room"),
			time: toHours(tr.id),
		};

		for (let [key, value] of Object.entries(slot)) {
			if (typeof key != "object") {
				cls[key] = value;
			};
		};
		
		slot.classes.push(cls);
	};
	
	return slot;
};

function updateTimetable() {
	let classesByDay = {
		Mon: [],
		Tue: [],
		Wed: [],
		Thu: [],
		Fri: [],
		Sat: [],
		Sun: []
	};

	for (let slot of slots) {
		for (let cls of slot.classes) {
			classesByDay[cls.day].push(cls);
		};
	};
	
	let timetable = document.getElementsByClassName("timetable")[0];
	let thead = Object.values(timetable.children).find(child => child.nodeName == "THEAD");
	let hourCells = Object.values(thead.firstElementChild.cells).slice(1);
	let startHour = parseInt(hourCells[0].innerText.match(/^\d{1,2}(?=\s*?:\s*?\d\d)/i));
	let endHour = parseInt(hourCells[hourCells.length - 1].innerText.match(/\d{1,2}(?=\s*?:\s*?\d\d$)/i));
	
	let tbody = Object.values(timetable.children).find(child => child.nodeName == "TBODY");
	let htmlRows = Object.values(tbody.children);

	for (let i = 0; i < htmlRows.length; i++) {
		tbody.removeChild(htmlRows[i]);
	};

	for (let [day, classes] of Object.entries(classesByDay)) {
		let rowSpan = 1;
		for (let i = 0; i < classes.length; i++) {
			for (let j = i + 1; j < classes.length; j++) {
				if (classes[i].time.end > classes[j].time.start && classes[i].time.start < classes[j].time.end) {
					rowSpan++;
				}
			}
		}

		classes.sort((cls1, cls2) => toWeeks(cls1.week)[0] - toWeeks(cls2.week)[0]);

		for (let row = 0; row < rowSpan; row++) {
			let htmlRow = document.createElement("tr");

			if (row == 0) {
				let dayCell = document.createElement("td");

				dayCell.rowSpan = rowSpan;
				dayCell.innerText = day;
	
				addClass(dayCell, "day");
	
				htmlRow.appendChild(dayCell);
			}

			for (let col = 0; col < hourCells.length * 2; col++) {
				let hour = startHour + col * 0.5;
				let slot = document.createElement("td");
				let clsIndex = classes.findIndex(cls => cls.time.start == hour);
	
				if (clsIndex > -1) {
					let cls = classes.splice(clsIndex, 1)[0];
					let { start, end } = cls.time;
					let durationHour = end - start;
	
					col += (durationHour - 0.5) / 0.5;
	
					slot.className = "previewSlot clickable"
					slot.style.background = cls.preview ? "" : cls.color;
					slot.style.border = "1px solid #7d7d7d";
					slot.colSpan = (durationHour / 0.5).toString();
	
					if (!cls.preview)
						slot.onclick = function() {
							let slotElement = document.getElementsByClassName(`code:${cls.code} type:${cls.type} group:${cls.group}`)[0];
							let courseElement = Array.from(document.getElementsByClassName("course")).find(element => element.innerText.match(cls.code));
							let timetableElement = document.getElementsByClassName("timetable")[0];
		
							if (slotElement.style.display == "none" && courseElement)
								toggleSlots(courseElement);
		
							let position = courseElement.getBoundingClientRect().top + window.pageYOffset - timetableElement.clientHeight;
		
							window.scrollTo({
								top: position
							});
						};
					else
						slot.style.opacity = "50%";
	
					let topDiv = document.createElement("div");
					let bottomDiv = document.createElement("div");
					let codeSpan = document.createElement("p");
					let typeSpan = document.createElement("b");
					let bracket1Span = document.createElement("span");
					let groupSpan = document.createElement("b");
					let bracket2Span = document.createElement("span");
					let roomSpan = document.createElement("p");
					let weekSpan = document.createElement("p");
	
					codeSpan.innerText = cls.code;
					typeSpan.innerText = cls.type;
					bracket1Span.innerText = "(";
					groupSpan.innerText = cls.group;
					bracket2Span.innerText = ")";
					roomSpan.innerText = cls.room;
					weekSpan.innerText = cls.week;
	
					codeSpan.style.margin = "0 15px 0 0";
					roomSpan.style.margin = "0 auto 0 0";
	
					addClass(roomSpan, "sub");
					addClass(weekSpan, "sub");
	
					topDiv.appendChild(codeSpan);
					topDiv.appendChild(typeSpan);
					topDiv.appendChild(bracket1Span);
					topDiv.appendChild(groupSpan);
					topDiv.appendChild(bracket2Span);
					bottomDiv.appendChild(roomSpan);
					bottomDiv.appendChild(weekSpan);
					slot.appendChild(topDiv);
					slot.appendChild(bottomDiv);
				};
	
				htmlRow.appendChild(slot);
			};
			
			tbody.appendChild(htmlRow);
		};
	}

	// for (let htmlRow of htmlRows) {
	// 	let cells = Object.values(htmlRow.cells);

	// 	let dayCell = cells.shift();
	// 	let day = dayCell.innerText;
	// 	let classes = classesByDay[day];
	// 	let totalClassHours = classes.reduce((accumulator, cls) => {
	// 		let { start, end } = cls.time;

	// 		return accumulator + end - start;
	// 	}, 0);

	// 	for (let i = 0; i < cells.length; i++) {
	// 		htmlRow.removeChild(cells[i]);
	// 	};

	// 	for (let col = 0; col < hourCells.length * 2; col++) {
	// 		let hour = startHour + col * 0.5;
	// 		let slot = document.createElement("td");
	// 		let cls = classes.find(cls => cls.time.start == hour);

	// 		if (cls) {
	// 			let { start, end } = cls.time;
	// 			let durationHour = end - start;

	// 			col += (durationHour - 0.5) / 0.5;

	// 			slot.className = "previewSlot clickable"
	// 			slot.style.background = cls.preview ? "" : cls.color;
	// 			slot.style.border = "1px solid #7d7d7d";
	// 			slot.colSpan = (durationHour / 0.5).toString();

	// 			if (!cls.preview)
	// 				slot.onclick = function() {
	// 					let slotElement = document.getElementsByClassName(`code:${cls.code} type:${cls.type} group:${cls.group}`)[0];
	// 					let courseElement = Array.from(document.getElementsByClassName("course")).find(element => element.innerText.match(cls.code));
	// 					let timetableElement = document.getElementsByClassName("timetable")[0];
	
	// 					if (slotElement.style.display == "none" && courseElement)
	// 						toggleSlots(courseElement);
	
	// 					let position = courseElement.getBoundingClientRect().top + window.pageYOffset - timetableElement.clientHeight;
	
	// 					window.scrollTo({
	// 						top: position
	// 					});
	// 				};
	// 			else
	// 				slot.style.opacity = "50%";

	// 			let topDiv = document.createElement("div");
	// 			let roomSpan = document.createElement("p");
	// 			let codeSpan = document.createElement("p");
	// 			let weekSpan = document.createElement("p");

	// 			roomSpan.innerText = cls.room;
	// 			codeSpan.innerText = `${cls.code}(${cls.type})(${cls.group})`;
	// 			weekSpan.innerText = cls.week;

	// 			codeSpan.style.width = "100%";
	// 			roomSpan.style.textAlign = "Right";

	// 			addClass(roomSpan, "sub");
	// 			addClass(weekSpan, "sub");

	// 			topDiv.appendChild(codeSpan);
	// 			topDiv.appendChild(roomSpan);
	// 			slot.appendChild(topDiv);
	// 			slot.appendChild(weekSpan);
	// 		};

	// 		htmlRow.appendChild(slot);
	// 	};
	// };
};

// function compareClassesFromSlots(selectedElement, callback) {
// 	let selectedSlot = getSlotDetails(selectedElement);
	
// 	for (let tbody of Object.values(document.getElementsByClassName("slot"))) {
// 		let slot = getSlotDetails(tbody);
		
// 		if ( // clean
// 			selectedSlot.course !== slot.course ||
// 			selectedSlot.type !== slot.type ||
// 			selectedSlot.group !== slot.group
// 		) {
// 			for (let selectedClass of selectedSlot.classes) {
// 				for (let cls of slot.classes) {
// 					callback({
// 						selectedElement: selectedElement,
// 						selectedSlot: selectedSlot,
// 						selectedClass: selectedClass,
// 						element: tbody,
// 						slot: slot,
// 						cls: cls,
// 					});
// 				};
// 			};
// 		};
// 	};
// };

function filterClashedSlots(selectedSlot, tbodies) {
	return tbodies.filter(tbody => {
		let mainRow = Object.values(tbody.rows).find(row => Object.values(row.cells).find(cell => cell.className.match(/remark/i)));
		let remarkCell = Object.values(mainRow.cells).find(cell => cell.className.match(/remark/i));
		let fullSpan = Object.values(remarkCell.children).find(child => child.className.match(/closed/i));

		if ((fullSpan.textContent || fullSpan.innerText).match(/closed/i)) return false;
		
		let slot = getSlotDetails(tbody);
		
		if (slot.code == selectedSlot.code && slot.type == selectedSlot.type) {
			if (slot.group != selectedSlot.group)
				return true;
	
			if (slot.group == selectedSlot.group)
				return false;
		};
	
		for (let cls of slot.classes) {
			for (let selectedCls of selectedSlot.classes) {
				if (cls.day == selectedCls.day) {
					if (cls.time.end > selectedCls.time.start && cls.time.start < selectedCls.time.end) {
						let clsWeeks = toWeeks(cls.week);
						let selectedWeeks = toWeeks(selectedCls.week);
						
						if (clsWeeks.findIndex(week => selectedWeeks.includes(week)) > -1)
							return true;
					}
				};
			};
		};
	});
};

function toggleSlots(element) {
	element.onclick = function() {
		untoggleSlots(element);
	};

	let text = element.firstElementChild.firstElementChild.innerHTML.substr(1);

	element.firstElementChild.firstElementChild.innerHTML = "▼" + text;

	let nextElement = element.nextElementSibling;

	while (nextElement && nextElement.className.match("slot")) {
		nextElement.style.display = "";

		nextElement = nextElement.nextElementSibling;
	};
};

function untoggleSlots(element) {
	element.onclick = function() {
		toggleSlots(element);
	};

	let text = element.firstElementChild.firstElementChild.innerHTML.substr(1);

	element.firstElementChild.firstElementChild.innerHTML = "▷" + text;

	let nextElement = element.nextElementSibling;

	while (nextElement.className.match("slot")) {
		nextElement.style.display = "none";

		nextElement = nextElement.nextElementSibling;
	};
};

function selectSlot(selectedElement, bySystem) {
	selectedElement.onclick = function() {
		unselectSlot(selectedElement)
	};
	selectedElement.onmouseover = function() {};
	selectedElement.onmouseout = function() {};

	removeClass(selectedElement, "highlightable");
	addClass(selectedElement, "selected");

	let selectedSlot = getSlotDetails(selectedElement);

	slots.push(selectedSlot);

	hideSlotPreview(selectedElement);

	let tbodies = filterClashedSlots(selectedSlot, Object.values(document.getElementsByClassName("slot")));

	for (let tbody of tbodies) {
		removeClass(tbody, "highlightable");
		removeClass(tbody, "clickable");
		addClass(tbody, "unavailable");

		tbody.onclick = function() {};
		tbody.onmouseover = function() {};
		tbody.onmouseout = function() {};
	};

	if (bySystem) return;

	fetch("/bid/add", {
		headers: {
			"content-type": "application/x-www-form-urlencoded"
		},
		method: "POST",
		body: `slot=${selectedSlot.code}-${selectedSlot.type}-${selectedSlot.group}`
	});
};

// function selectSlot(selectedElement) {
// 	selectedElement.onclick = function() {
// 		unselectSlot(selectedElement);
// 	};
// 	addClass(selectedElement, "selected");
	
// 	let selectedSlot = getSlotDetails(selectedElement);
	
// 	slots.push(selectedSlot);
		
// 	compareClassesFromSlots(selectedElement, ({ selectedSlot, selectedClass, slot, cls, element }) => {
// 		if (
// 			selectedClass.day == cls.day &&
// 			!(
// 				(selectedClass.time.end <= cls.time.start) ||
// 				(selectedClass.time.start >= cls.time.end)
// 			)
			
// 		) { // Clashed
// 			addClass(element, "clashed");
// 			removeClass(element, "clickable");
			
// 			element.onclick = function() {};
// 		};
		
// 		if (
// 			selectedSlot.code == slot.code &&
// 			selectedSlot.type == slot.type
// 		) { // Change group
// 			addClass(element, "included");
// 			removeClass(element, "clickable");
			
// 			element.onclick = function() {};
// 		};
// 	});
// };

function unselectSlot(selectedElement) {
	selectedElement.onclick = function() {
		selectSlot(selectedElement);
	};
	selectedElement.onmouseover = function() {
		showSlotPreview(selectedElement);
	};
	selectedElement.onmouseout = function() {
		hideSlotPreview(selectedElement);
	};
	
	removeClass(selectedElement, "selected");
	addClass(selectedElement, "highlightable");

	let selectedSlot = getSlotDetails(selectedElement);

	slots.splice(slots.findIndex(slot =>
		(
			!slot.preview &&
			slot.code == selectedSlot.code &&
			slot.type == selectedSlot.type &&
			slot.group == selectedSlot.group
		)
	), 1);

	showSlotPreview(selectedElement);

	let tbodies = filterClashedSlots(selectedSlot, Object.values(document.getElementsByClassName("slot")))
		.filter(tbody => {
			for (let slot of slots.filter(slot => !slot.preview)) {
				if (filterClashedSlots(slot, [tbody]).length > 0) 
					return false;
			};

			return true;
		});

	for (let tbody of tbodies) {
		removeClass(tbody, "unavailable");
		addClass(tbody, "highlightable");
		addClass(tbody, "clickable");

		tbody.onclick = function() {
			selectSlot(tbody);
		};
		tbody.onmouseover = function() {
			showSlotPreview(tbody);
		};
		tbody.onmouseout = function() {
			hideSlotPreview(tbody);
		};
	};

	fetch("/bid/remove", {
		headers: {
			"content-type": "application/x-www-form-urlencoded"
		},
		method: "POST",
		body: `slot=${selectedSlot.code}-${selectedSlot.type}-${selectedSlot.group}`
	});
};

function showSlotPreview(element) {
	let selectedSlot = getSlotDetails(element, true);

	slots.push(selectedSlot);

	updateTimetable();
};

function hideSlotPreview(element) {
	let selectedSlot = getSlotDetails(element);

	let index = slots.findIndex(slot =>
		(
			slot.preview &&
			slot.code == selectedSlot.code &&
			slot.type == selectedSlot.type &&
			slot.group == selectedSlot.group
		)
	)

	if (index == -1) return;
	
	slots.splice(index, 1);

	updateTimetable();
};

// function unselectSlot(selectedElement) {
// 	selectedElement.onclick = function() {
// 		selectSlot(selectedElement);
// 	};
// 	removeClass(selectedElement, "selected");
	
// 	let selectedSlot = getSlotDetails(selectedElement);
	
// 	slots.splice(slots.findIndex(slot =>
// 		(
// 			slot.code == selectedSlot.code &&
// 			slot.type == selectedSlot.type &&
// 			slot.group == selectedSlot.group
// 		)
// 	), 1);
	
// 	compareClassesFromSlots(selectedElement, ({ selectedSlot, selectedClass, slot, cls, element }) => {
// 		if (
// 			selectedClass.day == cls.day &&
// 			!(
// 				(selectedClass.time.end <= cls.time.start) ||
// 				(selectedClass.time.start >= cls.time.end)
// 			)
// 		) { // Clashed			
// 			removeClass(element, "clashed");
// 			addClass(element, "clickable");
			
// 			element.onclick = function() {
// 				selectSlot(element);
// 			};
// 		};
		
// 		if (
// 			selectedSlot.code == slot.code &&
// 			selectedSlot.type == slot.type
// 		) { // Same type
// 			removeClass(element, "included");
// 			addClass(element, "clickable");
			
// 			element.onclick = function() {
// 				selectSlot(element);
// 			};
// 		};
// 	});
// };

function getSlots() {
	return fetch("/bid/get").then(res => res.json());
}

function onSubmit() {
	const form = document.getElementsByTagName("form")[0];
	
	let slotsValue = slots.map(({ code, type, group }) => `${code}-${type}-${group}`).join(",");
	
	form.slots.value = slotsValue;
	
	form.submit();
};
