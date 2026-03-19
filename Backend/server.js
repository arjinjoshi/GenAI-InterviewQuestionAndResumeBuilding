require("dotenv").config();
const app = require("./src/app");
const connectToDB = require("./src/config/db");
const invokeGeminiAi = require("./src/services/ai.service");

connectToDB();

app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
})