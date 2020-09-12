'use strict';

const twilio = require('twilio');
const axios = require('axios');
const config = require('./config.json');

const projectId = process.env.GCLOUD_PROJECT;
const region = 'us-central1';

exports.reply = async (req, res) => {
  let isTwilioRequest = true;

  // Determine if the request came from Twilio
  if (process.env.NODE_ENV === 'production') {
    const options = { url: `https://us-central1-nutritionbot-289223.cloudfunctions.net/reply` };
    isTwilioRequest = twilio.validateExpressRequest(req, config.twilio.auth_token, options);
  }

  // If the request is not from Twilio, return an error message
  if (!isTwilioRequest) {
    res
      .status(403)
      .send('Invalid Twilio Request');
    return;
  }

  // Construct Axios config option containing information needed by Nutritionix API
  const messageBody = req.body.Body;
  const options = {
    method: 'post',
    url: 'https://trackapi.nutritionix.com/v2/natural/nutrients',
    headers: {
      'Content-Type': 'application/json',
      'x-app-id': config.nutritionix.app_id,
      'x-app-key': config.nutritionix.app_key
    },
    data: {
      'query': messageBody
    }
  }

  // Make request to Nutritionix API to get nutrition data for food
  const nutritionixResponse =
    await axios(options)
      .catch(error => {
        console.error(error);
        return null;
      });

  // If the request was successful, format the data for each food identified and add it to the response
  let nutritionResponse = "";
  if (nutritionixResponse) {

    nutritionixResponse.data.foods.forEach(foodItem => {
      nutritionResponse +=
        [
          `A serving size for ${foodItem.food_name} is ${foodItem.serving_qty} ${foodItem.serving_unit}. `,
          `The nutritional information for one serving is: \n \n`,
          `Calories: ${foodItem.nf_calories} \n`,
          `Total Fat: ${foodItem.nf_total_fat}g \n`,
          `Sodium: ${foodItem.nf_sodium}mg \n`,
          `Sugars: ${foodItem.nf_sugars}g \n`,
          `Dietary Fibers: ${foodItem.nf_dietary_fiber}g \n`,
          `Protein: ${foodItem.nf_protein}g \n \n`
        ].join('');
    });

  } else {
    nutritionResponse = "No nutritional information was found. Please try again.";
  }

  // Construct a SMS message response and add the output text to it
  const MessagingResponse = twilio.twiml.MessagingResponse;
  const response = new MessagingResponse();
  response.message(nutritionResponse);

  // Send response
  res
    .status(200)
    .type('text/xml')
    .end(response.toString());
};
