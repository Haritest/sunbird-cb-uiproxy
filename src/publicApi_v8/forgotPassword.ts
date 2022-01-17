import axios from 'axios'
import { Router } from 'express'
import _ from 'lodash'
import { axiosRequestConfig } from '../configs/request.config'
import { CONSTANTS } from '../utils/env'
import { logError, logInfo } from '../utils/logger'

const API_END_POINTS = {
  generateOtp: `${CONSTANTS.SUNBIRD_PROXY_API_BASE}/otp/v1/generate`,
  recoverPassword: `${CONSTANTS.LEARNER_SERVICE_API_BASE}/private/user/v1/password/reset`,
  searchSb: `${CONSTANTS.LEARNER_SERVICE_API_BASE}/private/user/v1/search`,
  verifyOtp: `${CONSTANTS.SUNBIRD_PROXY_API_BASE}/otp/v1/verify`,
}

export const forgotPassword = Router()

forgotPassword.post('/reset/proxy/password', async (req, res) => {
  logInfo('Entered into /reset/proxy/password ')
  try {
    logInfo('Entered into try block ')
    const sbUsername = req.body.userName
    const userType = await emailOrMobile(sbUsername)

    logInfo('User type : ', userType)
    logInfo('UserName : ', sbUsername)
    logInfo('Entered into try block userName : ', sbUsername)
    if (userType === 'email') {
      logInfo('Entered into email ')
      const searchresponse = await axios({
        ...axiosRequestConfig,
        data: {
          request: { filters: {
                       email: sbUsername.toLowerCase(),
                      },
                    },
        },
        method: 'POST',
        url: API_END_POINTS.searchSb,
      })

      if (searchresponse.data.result.response.count > 0) {
        logInfo('Inside email type checking..')
        const userUUId = _.get(
          _.find(searchresponse.data.result.response.content, 'userId'),
          'userId'
        )
        logInfo('>>>>>>>> User Id : ', userUUId)

        // generate otp
        const sendResponse = await axios({
          ...axiosRequestConfig,
          data: {
            request: { userId: userUUId, key: sbUsername, type: userType },
          },
          headers: { Authorization: CONSTANTS.SB_API_KEY },
          method: 'POST',
          url: API_END_POINTS.generateOtp,
        })
        logInfo('Sending Responses in email : ' + sendResponse)
        // res.status(200).send(userUUId)
        res.status(200).send({ message: 'Success ! Please verify the OTP .' })
        return
      } else {
        logInfo(
          'Couldnot find the user : ',
          searchresponse.data.result.response
        )
        res.status(302).send(searchresponse.data.result.response.count)
      }
    } else if (userType === 'phone') {
      const searchresponse = await axios({
        ...axiosRequestConfig,
        data: {
          request: { query: '', filters: { phone: sbUsername.toLowerCase() } },
        },
        method: 'POST',
        url: API_END_POINTS.searchSb,
      })
      logInfo('Inside phone type checking..')
      if (searchresponse.data.result.response.count > 0) {
        const userUUId = _.get(
          _.find(searchresponse.data.result.response.content, 'userId'),
          'userId'
        )
        logInfo('User Id : ', userUUId)

        // generate otp
        const sendResponse = await axios({
          ...axiosRequestConfig,
          data: {
            request: { userId: userUUId, key: sbUsername, type: userType },
          },
          headers: { Authorization: CONSTANTS.SB_API_KEY },
          method: 'POST',
          url: API_END_POINTS.generateOtp,
        })
        logInfo('Sending Responses in phone part : ' + sendResponse)
        res.status(200).send({ message: 'Success ! Please verify the OTP .' })
        return
      } else {
        logInfo(
          'Couldnot find the user : ',
          searchresponse.data.result.response
        )
        res.status(302).send(searchresponse.data.result.response.count)
      }
    } else {
      logError('Error in Usertype : Neither validated email nor phone ')
      res.status(500).send('Error Ocurred ')
    }
    return
  } catch (err) {
    logError('ERROR in Searching Users : ' + err)
    res.status(500).send('Error Ocurred : ' + err)
  }
})

forgotPassword.post('/verifyOtp', async (req, res) => {
  const key = req.body.key
  const userType = req.body.type
  const validOtp = req.body.otp
  try {
    if (userType === 'email') {
      logInfo('Entered inside email')
      const searchresponse = await axios({
        ...axiosRequestConfig,
        data: { request: { filters: { email: key.toLowerCase() } } },
        method: 'POST',
        url: API_END_POINTS.searchSb,
      })

      if (searchresponse.data.result.response.count > 0) {
        const userUUId = _.get(
          _.find(searchresponse.data.result.response.content, 'userId'),
          'userId'
        )
        logInfo('User Id in Email : ', userUUId)

        const sendResponse = await axios({
          ...axiosRequestConfig,
          data: {
            request: { userId: userUUId, key, type: userType, otp: validOtp },
          },
          headers: { Authorization: req.header('Authorization') },
          method: 'POST',
          url: API_END_POINTS.recoverPassword,
        })
        logInfo('Success ! Recover password working for email.. ')
        res.status(200).send(sendResponse.data.result)
      }
    } else if (userType === 'phone') {
      logInfo('Entered inside email')
      const searchresponse = await axios({
        ...axiosRequestConfig,
        data: { request: { query: '', filters: { phone: key.toLowerCase() } } },
        method: 'POST',
        url: API_END_POINTS.searchSb,
      })
      if (searchresponse.data.result.response.count > 0) {
        const userUUId = _.get(
          _.find(searchresponse.data.result.response.content, 'userId'),
          'userId'
        )
        logInfo('User Id in phone : ', userUUId)

        const sendResponse = await axios({
          ...axiosRequestConfig,
          data: {
            request: { userId: userUUId, key, type: userType, otp: validOtp },
          },
          headers: { Authorization: CONSTANTS.SB_API_KEY },
          method: 'POST',
          url: API_END_POINTS.recoverPassword,
        })
        logInfo('Success ! Recover password working for phone.. ')
        res.status(200).send(sendResponse.data.result)
      }
    } else {
      logError('Error in Usertype : Neither validated email nor phone ')
      res
        .status(403)
        .send('Error in Usertype : Neither validated email nor phone')
    }
    return
  } catch (err) {
    logError('ERROR in Searching Users : ' + err)
    res.status(500).send('Error Ocurred : ' + err)
  }
})

export function emailOrMobile(value: string) {
  const isValidEmail = emailValidator(value)
  if (isValidEmail) {
    return 'email'
  } else {
    const isValidMobile = mobileValidator(value)
    if (isValidMobile) {
      return 'phone'
    }
  }
  return 'error'
}

export function emailValidator(value: string) {
  // tslint:disable-next-line: max-line-length
  return /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(
    value
  )
}

const mobileValidator = (value: string) => {
  return /^([7-9][0-9]{9})$/.test(value)
}
