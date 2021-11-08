import axios from "axios";
import { Router } from "express";
import _ from "lodash";
import { axiosRequestConfig } from "../configs/request.config";
import { logError, logInfo } from "../utils/logger";
export const assessmentApi = Router();
assessmentApi.post("/get", async (req, res) => {
  try {
    if (!req.body.artifactUrl) {
      res.status(400).json({
        msg: "artifact Url can not be empty",
        status: "error",
        status_code: 400,
      });
    }
    const { artifactUrl } = req.body;
    const assessmentData = await fetchAssessment(artifactUrl);
    const formatedData = getFormatedResponse(assessmentData);
    res.status(200).json({ questions: formatedData });
    logInfo("formatedData Data in JSON :", JSON.stringify(formatedData));
  } catch (err) {
    res.status(401).send({
      error: "error while fetching assesment !!",
    });
  }
});
// tslint:disable-next-line: no-any
const fetchAssessment = async (artifactUrl: string) => {
  logInfo("Checking fetchAssessment : ", artifactUrl);
  try {
    const response = await axios({
      ...axiosRequestConfig,
      method: "GET",
      url: artifactUrl,
    });
    logInfo("Response Data in JSON :", JSON.stringify(response.data));
    if (response.data.questions) {
      logInfo("Response questions :", _.get(response, "data"));
      return _.get(response, "data");
    }
  } catch (err) {
    logError("fetchAssement  failed");
  }
};
// tslint:disable-next-line: no-any
const getFormatedResponse = (data: any) => {
  logInfo(
    "Response of questions in formated method JSON :",
    JSON.stringify(data.questions)
  );
  return _.forEach(data.questions, (qkey) => {
    logInfo("inside for each");
    logInfo("inside qkey ", qkey.questionType);
    if (qkey.questionType === "mcq-sca" && qkey.options.length > 0) {
      _.forEach(qkey.options, (optKey) => {
        _.set(optKey, "isCorrect", "false");
      });
      // eslint-disable-next-line
    } else if (qkey.questionType === "mtf" && qkey.options.length > 0) {
      _.forEach(qkey.options, (optKey) => {
        _.set(optKey, "isCorrect", "false");
        _.set(optKey, "match", "");
      });
    } else if (qkey.questionType === "fitb" && qkey.options.length > 0) {
      _.forEach(qkey.options, (optKey) => {
        _.set(optKey, "isCorrect", "false");
        _.set(optKey, "text", "");
      });
    }
  });
};
