'use strict';

const request = require('request-promise-native');
const BANK_HOLIDAY_API = 'https://www.gov.uk/bank-holidays.json';
const SKILL_NAME = "UK Bank Holidays";
const LIST_OF_UK_COUNTRIES = ["england", "scotland", "wales", "ireland", "northern ireland"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
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
  const repromptText = 'You can ask me for information about UK bank holidays. Try saying "when is the next bank holiday in England?"';
  const textOutput = repromptText;
  const speechOutput = 'Welcome to ' + SKILL_NAME + '. ' + repromptText;
  const shouldEndSession = false;

  callback(sessionAttributes,
    buildSpeechletResponse(cardTitle, textOutput, repromptText, shouldEndSession, speechOutput, false));
}

function onSessionStarted(sessionStartedRequest, session) {
  console.log(`onSessionStarted requestId=${sessionStartedRequest.requestId}, sessionId=${session.sessionId}`);
}

function onLaunch(launchRequest, session, callback) {
  console.log(`onLaunch requestId=${launchRequest.requestId}, sessionId=${session.sessionId}`);

  getWelcomeResponse(callback);
}

function handleSessionEndRequest(callback) {
  const sessionAttributes = {};
  const cardTitle = 'Goodbye';
  const repromptText = "Thank you for using UK Bank Holidays. Goodbye!";
  const textOutput = repromptText;
  const speechOutput = 'Thank you for using UK Bank Holidays. Goodbye!';
  const shouldEndSession = true;


  callback(sessionAttributes, buildSpeechletResponse(cardTitle, textOutput, repromptText, shouldEndSession, speechOutput, false));
}

/* On Intent Functions */
function buildSpeechletResponse(title, textOutput, repromptText, shouldEndSession, speechOutput = textOutput, directiveSlot) {
  if (directiveSlot) {
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
      directives: [
        {
            type: 'Dialog.ElicitSlot',
            slotToElicit: directiveSlot
        }
      ]
    };
  } else {
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
    getWelcomeResponse(callback);
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

  if (country === undefined || LIST_OF_UK_COUNTRIES.indexOf(country.toLowerCase()) < 0) {
    var directiveSlot = "Country";
    var sessionAttributes = {};
    var textOutput = "What part of the UK are you in? For example: England or Northern Ireland.";
    var repromptText = "Sorry, I didn't quite catch that. " + textOutput;
    var shouldEndSession = false;
    var speechOutput = "What part of the UK are you in? For example: England or Northern Ireland.";
    callback(
      sessionAttributes,
      buildSpeechletResponse(SKILL_NAME, textOutput, repromptText, shouldEndSession, speechOutput, directiveSlot)
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

      for (var i = 0; i <= sortedDataForCountry.length; i++) {
        var date = new Date(sortedDataForCountry[i].date);
        if (date > currentDate) {
          nextBankHoliday = sortedDataForCountry[i];
          break;
        }
      }

      var optionalNotes = nextBankHoliday.notes !== "" ? ". This is a " + nextBankHoliday.notes : "";

      if (nextBankHoliday) {
        var directiveSlot = "Country";
        var sessionAttributes = {};
        var textOutput = "The next bank holiday in " + country + " is " + nextBankHoliday.title + " on " + nextBankHoliday.date + optionalNotes;
        var repromptText = null;
        var shouldEndSession = true;
        var speechOutput = "The next bank holiday in " + country + " is " + nextBankHoliday.title + " on " + nextBankHoliday.date + optionalNotes;
        callback(
          sessionAttributes,
          buildSpeechletResponse(SKILL_NAME, textOutput, repromptText, shouldEndSession, speechOutput, directiveSlot)
        );
      } else {
        var directiveSlot = "Country";
        var sessionAttributes = {};
        var textOutput = "I could not find any upcoming bank holidays! Please try again later."
        var repromptText = null;
        var shouldEndSession = true;
        var speechOutput = "I could not find any upcoming bank holidays! Please try again later."
        callback(
          sessionAttributes,
          buildSpeechletResponse(SKILL_NAME, textOutput, repromptText, shouldEndSession, speechOutput, directiveSlot)
        );
      }
    }).catch(function(error) {
      sendError("Country");
    });
  }
}

function intentIsDateBankHoliday(intent, session, callback, bankHolidayData) {
  var givenDate = intent.slots.Date.value;

  if (givenDate === undefined) {
    var directiveSlot = "Date";
    var sessionAttributes = {};
    var textOutput = "Sorry, I didn't quite catch which date was said. Please repeat the date.";
    var repromptText = textOutput;
    var shouldEndSession = false;
    var speechOutput = "Sorry, I didn't quite catch which date was said. Please repeat the date.";
    callback(
      sessionAttributes,
      buildSpeechletResponse(SKILL_NAME, textOutput, repromptText, shouldEndSession, speechOutput, directiveSlot)
    );
  } else {
    var data = getBankHolidayData().then(function(bankHolidayData) {
      givenDate = new Date(givenDate);

      var matchingDates = [];

      for (var country in bankHolidayData) {
        var eventsInCountry = bankHolidayData[country]["events"];

        eventsInCountry.forEach(function(event) {
          var eventDate = new Date(event.date);

          if (+eventDate === +givenDate) {
            event.country = bankHolidayData[country].division
            matchingDates.push(event);
          }
        })
      }

      if (matchingDates.length > 0) {
        var responseString = intent.slots.Date.value + " is a bank holiday in ";
        var matchingCountries = [];
        var matchingHolidayTitles = [];

        // Retrieve countries which this bank holiday applies to
        // Retrieve bank holiday titles
        matchingDates.forEach(function(matchingBankHoliday) {
          if (matchingCountries.indexOf(matchingBankHoliday.country) < 0 ) {
            matchingCountries.push(matchingBankHoliday.country);
          }
          var optionalNotes = matchingBankHoliday.notes !== "" ? " (" + matchingBankHoliday.notes + ") " : "";

          if (matchingHolidayTitles.indexOf(matchingBankHoliday.title + optionalNotes) < 0 ) {
            matchingHolidayTitles.push(matchingBankHoliday.title + optionalNotes);
          }
        });
        responseString += constructSentenceFromArray(matchingCountries);
        responseString += " This day is ";
        responseString += constructSentenceFromArray(matchingHolidayTitles);

        var directiveSlot = "Date";
        var sessionAttributes = {};
        var textOutput = responseString;
        var repromptText = null;
        var shouldEndSession = true;
        var speechOutput = responseString;
        callback(
          sessionAttributes,
          buildSpeechletResponse(SKILL_NAME, textOutput, repromptText, shouldEndSession, speechOutput, directiveSlot)
        );
      } else {
        var directiveSlot = "Date";
        var sessionAttributes = {};
        var textOutput = "I could not find any bank holidays in the UK on " + intent.slots.Date.value ;
        var repromptText = null;
        var shouldEndSession = true;
        var speechOutput = "I could not find any bank holidays in the UK on " + intent.slots.Date.value ;
        callback(
          sessionAttributes,
          buildSpeechletResponse(SKILL_NAME, textOutput, repromptText, shouldEndSession, speechOutput, directiveSlot)
        );
      }
    }).catch(function(error) {
      sendError("Date");
    });
  }
}

function intentGetBankHolidaysMonth(intent, session, callback, bankHolidayData) {
  var givenMonth = intent.slots.Month.value;

  if (givenMonth === undefined) {
    var directiveSlot = "Month";
    var sessionAttributes = {};
    var textOutput = "Sorry, I didn't quite catch which month was said. Please repeat the month.";
    var repromptText = textOutput;
    var shouldEndSession = false;
    var speechOutput = "Sorry, I didn't quite catch month date was said. Please repeat the month.";
    callback(
      sessionAttributes,
      buildSpeechletResponse(SKILL_NAME, textOutput, repromptText, shouldEndSession, speechOutput, directiveSlot)
    );
  } else {
    var data = getBankHolidayData().then(function(bankHolidayData) {
      // givenMonth defaults to 1st of month. When comparing, only compare with month value.
      givenMonth = new Date(givenMonth);

      var matchingDates = [];

      for (var country in bankHolidayData) {
        var eventsInCountry = bankHolidayData[country]["events"];

        eventsInCountry.forEach(function(event) {
          var eventDate = new Date(event.date);

          if (eventDate.getMonth() === givenMonth.getMonth() && eventDate.getYear() === givenMonth.getYear()) {
            event.country = bankHolidayData[country].division
            matchingDates.push(event);
          }
        })
      }

      if (matchingDates.length > 0) {
        var responseString = "";
        var collapsedBankHolidayData = [];

        matchingDates.forEach(function(matchingBankHolidays) {
          if (collapsedBankHolidayData.indexOf(matchingBankHolidays.date + " is " + matchingBankHolidays.title + " in ") < 0 ) {
            var optionalNotes = matchingBankHolidays.notes !== "" ? " (" + matchingBankHolidays.notes + ") "  : "";
            collapsedBankHolidayData.push(matchingBankHolidays.date + " is " + matchingBankHolidays.title + optionalNotes + " in ");
          }
        });

        matchingDates.forEach(function(matchingBankHolidays) {
          for (var i = 0; i < collapsedBankHolidayData.length; i++) {
            if (collapsedBankHolidayData[i].includes(matchingBankHolidays.date) && collapsedBankHolidayData[i].includes(matchingBankHolidays.title) && !collapsedBankHolidayData[i].includes(matchingBankHolidays.country)) {
              collapsedBankHolidayData[i] += matchingBankHolidays.country + ", ";
            }
          }
        });

        // Construct response string
        var areOrIs = collapsedBankHolidayData.length > 1 ? "are " : "is ";
        var holidayOrHolidays = collapsedBankHolidayData.length > 1 ? "holidays" : "holiday";

        responseString += "There " + areOrIs + collapsedBankHolidayData.length + " bank " + holidayOrHolidays + " in " + MONTHS[givenMonth.getMonth()] + " " + givenMonth.getFullYear() + ". ";

        collapsedBankHolidayData.forEach(function(holiday) {
          responseString += holiday + ". ";
        });

        console.log(responseString);

        var directiveSlot = "Month";
        var sessionAttributes = {};
        var textOutput = responseString;
        var repromptText = null;
        var shouldEndSession = true;
        var speechOutput = responseString;
        callback(
          sessionAttributes,
          buildSpeechletResponse(SKILL_NAME, textOutput, repromptText, shouldEndSession, speechOutput, directiveSlot)
        );
      } else {
        var directiveSlot = "Month";
        var sessionAttributes = {};
        var textOutput = "I could not find any bank holidays in the UK in " + MONTHS[givenMonth.getMonth()] + " " + givenMonth.getFullYear() ;
        var repromptText = null;
        var shouldEndSession = true;
        var speechOutput = "I could not find any bank holidays in the UK in " + MONTHS[givenMonth.getMonth()] + " " + givenMonth.getFullYear();
        callback(
          sessionAttributes,
          buildSpeechletResponse(SKILL_NAME, textOutput, repromptText, shouldEndSession, speechOutput, directiveSlot)
        );
      }
    }).catch(function(error) {
      sendError("Month");
    });
  }
}

/* Helper Functions */

function sendError(directiveSlot) {
  var sessionAttributes = {};
  var textOutput = "Sorry, something went wrong retrieving the bank holiday information! Please try again later."
  var repromptText = null;
  var shouldEndSession = true;
  var speechOutput = "Sorry, something went wrong retrieving the bank holiday information! Please try again later."
  callback(
    sessionAttributes,
    buildSpeechletResponse(SKILL_NAME, textOutput, repromptText, shouldEndSession, speechOutput, directiveSlot)
  );
}

function getBankHolidayData() {
  return request({url: BANK_HOLIDAY_API, json: true});
}

function sortByDate(a, b){
  var dateA = new Date(a.date).getTime();
  var dateB = new Date(b.date).getTime();
  return dateA > dateB ? 1 : -1;
};

function constructSentenceFromArray(array) {
  var sentence = "";

  for (var i = 0; i < array.length; i++) {
    sentence += array[i];

    if (i + 1 === array.length) {
      sentence += ".";
    }
    else if (i + 1 === array.length - 1) {
      sentence += " and ";
    }
    else {
      sentence += ", ";
    }
  }

  return sentence;
}
