'use strict';

const request = require('request-promise-native');
const BANK_HOLIDAY_API = 'https://www.gov.uk/bank-holidays.json';
const SKILL_NAME = "UK Bank Holidays";
const LIST_OF_UK_COUNTRIES = ["england", "scotland", "wales", "ireland", "northern ireland"];
/* Setup Functions */

function buildResponse(sessionAttributes, speechletResponse) {
  return {
    version: '1.0',
    sessionAttributes,
    response: speechletResponse,
  };
}

exports.handler = (event, context, callback) => {
  try {
    console.log(`event.session.application.applicationId=${event.session.application.applicationId}`);

    if (event.session.new) {
      onSessionStarted({ requestId: event.request.requestId }, event.session);
    }

    if (event.request.type === 'LaunchRequest') {
      onLaunch(event.request,
        event.session,
        (sessionAttributes, speechletResponse) => {
          callback(null, buildResponse(sessionAttributes, speechletResponse));
        });
    } else if (event.request.type === 'IntentRequest') {
      onIntent(event.request,
        event.session,
        (sessionAttributes, speechletResponse) => {
          callback(null, buildResponse(sessionAttributes, speechletResponse));
        });
    } else if (event.request.type === 'SessionEndedRequest') {
      onSessionEnded(event.request, event.session);
      callback();
    }
  } catch (err) {
    callback(err);
  }
};

/* Session Start & End Functions */

function getWelcomeResponse(callback) {
  const sessionAttributes = {};
  const cardTitle = 'Welcome';
  const repromptText = 'You can ask me for the next bank holiday, or if a specific date is a bank holiday.';
  const speechOutput = 'Welcome to ' + SKILL_NAME + '. ' + repromptText;
  const shouldEndSession = false;

  callback(sessionAttributes,
    buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
}

function onSessionStarted(sessionStartedRequest, session) {
  console.log(`onSessionStarted requestId=${sessionStartedRequest.requestId}, sessionId=${session.sessionId}`);
}

function onLaunch(launchRequest, session, callback) {
  console.log(`onLaunch requestId=${launchRequest.requestId}, sessionId=${session.sessionId}`);

  getWelcomeResponse(callback);
}

function handleSessionEndRequest(callback) {
  const cardTitle = 'Goodbye';
  const speechOutput = 'Thank you for using UK Bank Holidays. Goodbye!';
  const shouldEndSession = true;

  callback({}, buildSpeechletResponse(cardTitle, speechOutput, null, shouldEndSession));
}

/* On Intent Functions */
function buildSpeechletResponse(title, textOutput, repromptText, shouldEndSession, speechOutput = textOutput) {
  return {
    outputSpeech: {
      type: 'PlainText',
      text: speechOutput,
    },
    card: {
      type: 'Simple',
      title: `${title}`,
      content: `${textOutput}`,
    },
    reprompt: {
      outputSpeech: {
        type: 'PlainText',
        text: repromptText,
      },
    },
    shouldEndSession,
  };
}

function onIntent(intentRequest, session, callback) {
  console.log(`onIntent requestId=${intentRequest.requestId}, sessionId=${session.sessionId}`);

  const intent = intentRequest.intent;
  const intentName = intentRequest.intent.name;

  if (intentName === 'GetNextBankHoliday') {
    intentGetNextBankHoliday(intent, session, callback);
  } else if (intentName === 'IsDateBankHoliday') {
    intentIsDateBankHoliday(intent, session, callback);
  } else if (intentName === 'GetBankHolidaysMonth') {
    intentGetBankHolidaysMonth(intent, session, callback);
  } else if (intentName === 'AMAZON.HelpIntent') {
    getWelcomeResponse(callback);
  } else if (intentName === 'AMAZON.StopIntent' || intentName === 'AMAZON.CancelIntent') {
    handleSessionEndRequest(callback);
  } else {
    throw new Error('Invalid intent');
  }
}

function onSessionEnded(sessionEndedRequest, session) {
  console.log(`onSessionEnded requestId=${sessionEndedRequest.requestId}, sessionId=${session.sessionId}`);
}

/* Intent Logic Functions */

/**
 * Get next bank holiday for the given country (England, Wales, Scotland, Northern Ireland)
 * @param {*} intent
 * @param {*} session
 * @param {*} callback
 * @param {*} bankHolidayData
 */
function intentGetNextBankHoliday(intent, session, callback, bankHolidayData) {
  var country = intent.slots.Country.value;
  console.log(intent.slots.Country.value);

  if (country === undefined || LIST_OF_UK_COUNTRIES.indexOf(country.toLowerCase()) < 0) {
    var sessionAttributes = {};
    var textOutput = "What part of the UK are you in? For example: England or Northern Ireland.";
    var repromptText = "Sorry, I didn't quite catch that. " + textOutput;
    var shouldEndSession = false;
    var speechOutput = "What part of the UK are you in? For example: England or Northern Ireland.";
    callback(
      sessionAttributes,
      buildSpeechletResponse(SKILL_NAME, textOutput, repromptText, shouldEndSession, speechOutput)
    );
  }
  else {
    country = country.toLowerCase();
    var data = getBankHolidayData().then(function(bankHolidayData) {
      if (country === "england" || country === "wales") {
        country = "england-and-wales";
      }
      else if (country === "ireland") {
        country = "northern-ireland";
      }

      var currentDate = new Date();
      var dataForCountry = bankHolidayData[country.replace(/\s+/g, '-')]["events"];
      var sortedDataForCountry = dataForCountry.sort(sortByDate)
      var nextBankHoliday = false;

      for (var i = 0; i < sortedDataForCountry.length; i++) {
        var date = new Date(sortedDataForCountry[i].date);
        if (date > currentDate) {
          nextBankHoliday = sortedDataForCountry[i];
          break;
        }
      }

      if (nextBankHoliday) {
        var sessionAttributes = {};
        var textOutput = "The next bank holiday in " + country + " is " + nextBankHoliday.title + " on " + nextBankHoliday.date;
        var repromptText = null;
        var shouldEndSession = true;
        var speechOutput = "The next bank holiday in " + country + " is " + nextBankHoliday.title + " on " + nextBankHoliday.date;
        callback(
          sessionAttributes,
          buildSpeechletResponse(SKILL_NAME, textOutput, repromptText, shouldEndSession, speechOutput)
        );
      } else {
        var sessionAttributes = {};
        var textOutput = "We could not find any upcoming bank holidays! Please try again later."
        var repromptText = null;
        var shouldEndSession = true;
        var speechOutput = "We could not find any upcoming bank holidays! Please try again later."
        callback(
          sessionAttributes,
          buildSpeechletResponse(SKILL_NAME, textOutput, repromptText, shouldEndSession, speechOutput)
        );
      }
    }).catch(function(error) {
      console.log(error);
      var sessionAttributes = {};
      var textOutput = "Sorry, something went wrong retrieving the bank holiday information! Please try again later."
      var repromptText = null;
      var shouldEndSession = true;
      var speechOutput = "Sorry, something went wrong retrieving the bank holiday information! Please try again later."
      callback(
        sessionAttributes,
        buildSpeechletResponse(SKILL_NAME, textOutput, repromptText, shouldEndSession, speechOutput)
      );
    });
  }
}

/* Helper Functions */

function getBankHolidayData() {
  return request({url: BANK_HOLIDAY_API, json: true});
}

function sortByDate(a, b){
  var dateA = new Date(a.date).getTime();
  var dateB = new Date(b.date).getTime();
  return dateA > dateB ? 1 : -1;
};