'use strict';

const AWS = require('aws-sdk');
const NODEMAILER = require('nodemailer');
const DATEFORMAT = require('dateformat');

const SESCLIENT = new AWS.SES()
const S3CLIENT = new AWS.S3();
const DDBCLIENT = new AWS.DynamoDB.DocumentClient();


function getRelativeDate(offset) {
  var relativeDt = new Date(new Date().setDate(new Date().getDate() + offset));
  return DATEFORMAT(relativeDt, "yyyy-mm-dd");
}

function getS3File(bucket, key) {
    return new Promise(function (resolve, reject) {
        S3CLIENT.getObject(
            {
                Bucket: bucket,
                Key: key
            },
            function (err, data) {
                if (err) return reject(err);
                else return resolve(data);
            }
        );
    })
}

function sendMail(fileData, recipientID) {
  console.log("To = "+recipientID);
  var mailOptions = {
      from: process.env.FROM_EMAILID,
      subject: 'Trial Ending Soon!',
      html: "<p>You got a discounted offer on <b>Signup.</b></p>",
      to: recipientID,
      // bcc: Any BCC address you want here in an array,
      attachments: [
          {
              filename: "Signup Offer.pdf",
              content: fileData.Body
          }
      ]
  };

  console.log('Creating SES transporter');
  // create Nodemailer SES transporter
  var transporter = NODEMAILER.createTransport({
      SES: SESCLIENT
  });

  // send email
  transporter.sendMail(mailOptions, function (err, info) {
      if (err) {
          console.log(err);
          console.log('Error sending email');
      } else {
          console.log('Email sent successfully');
      }
  });
}


module.exports.fetchTrialUsers = (event, context, callback) => {
  
  var ddTableName = process.env.CUSTOMER_TABLE;
  console.log("Table Name = " + ddTableName);
  console.log("Query date = " + getRelativeDate(2));

  var params = {
    TableName: ddTableName,
    FilterExpression:"#trialEndDate = :dateValue",
    ProjectionExpression: 'emailID',
    ExpressionAttributeNames: {
        "#trialEndDate":"trialEndDate"
        },
    ExpressionAttributeValues: {
        ":dateValue": getRelativeDate(2)
        }
    };

  DDBCLIENT.scan(params, function(err, data) {
    if (err) {
      console.log("Error", err);
    } else {
      console.log("DB Fetch Success", data.Items);
      data.Items.forEach(function(element, index, array) {
        var recipientID = element.emailID;
        console.log("Emails ID: " + recipientID);
        var fileData = getS3File(process.env.ATTACHMENT_BUCKET, process.env.ATTACHMENT_KEY);
        console.log("File attachment recieved successfully.");
        sendMail(fileData, recipientID);
        console.log("Job Processing Done.");
      });
    }
  });
};