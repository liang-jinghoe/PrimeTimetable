module.exports = `
CREATE TABLE IF NOT EXISTS users (
	user_id INT(10) NOT NULL,
	password VARCHAR(25) NOT NULL,
	PRIMARY KEY(user_id)
);

CREATE TABLE IF NOT EXISTS courses (
	course_code VARCHAR(10) NOT NULL,
	name VARCHAR(255) NOT NULL,
	credit_hours INT(1),
	PRIMARY KEY(course_code)
);

CREATE TABLE IF NOT EXISTS slots (
	slot_id SERIAL,
	course_code VARCHAR(10),
	type CHAR(1) NOT NULL,
	group INT(3) NOT NULL,
	size INT(3) NOT NULL,
	PRIMARY KEY(slot_id),
	CONSTRAINT fk_course
		FOREIGN KEY(course_code)
			REFERENCES courses(course_code)
			ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS classes (
	slot_id INT,
	day VARCHAR(3) NOT NULL,
	time VARCHAR(25) NOT NULL,
	hour INT(1),
	week VARCHAR(5) NOT NULL,
	room VARCHAR(5) NOT NULL,
	remark VARCHAR(255),
	CONSTRAINT fk_slot
		FOREIGN KEY(slot_id)
			REFERENCES slots(slot_id)
			ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS slot_reservation (
	user_id INT(10),
	slot_id INT,
	CONSTRAINT fk_user
		FOREIGN KEY(user_id)
			REFERENCES users(user_id)
			ON DELETE CASCADE,
	CONSTRAINT fk_slot
		FOREIGN KEY(slot_id)
			REFERENCES slots(slot_id)
			ON DELETE CASCADE
);
`;

// Remember to add one more table for promode code
