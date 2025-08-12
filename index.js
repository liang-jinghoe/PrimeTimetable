import app from "./app/index.js";

app.listen(process.env.PORT || 3030, function() {
	console.log("Server running...");
});
