const axios = require("axios");

async function testZakbot() {
  try {
    const res = await axios.post("https://zakbot.zaktomate.com/api/chat", {
      message: "What services does Zakbot offer?"
    });
    console.log("Zakbot reply:", res.data.reply);
  } catch (error) {
    console.error(error);
  }
}

testZakbot();
