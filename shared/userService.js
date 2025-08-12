export const cachedUsers = {};

function cache(key, user) {
	cachedUsers[key] = user;
};

function retrieve(key) {
	return cachedUsers[key];
};

export default {
	cache,
	retrieve
};
