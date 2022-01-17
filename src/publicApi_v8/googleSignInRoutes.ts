import axios from 'axios'
import { Router } from 'express'
import { OAuth2Client } from 'google-auth-library'
import _ from 'lodash'
import qs from 'querystring'
import jwt_decode from 'jwt-decode'
import { axiosRequestConfig } from '../configs/request.config'
import { CONSTANTS } from '../utils/env'
import { logError, logInfo } from '../utils/logger'
import { getCurrentUserRoles } from './rolePermission'
const API_END_POINTS = {
    createUserWithMailId: `${CONSTANTS.KONG_API_BASE}/user/v1/signup`,
   fetchUserByEmailId: `${CONSTANTS.KONG_API_BASE}/user/v1/exists/email/`,
   generateToken: `${CONSTANTS.HTTPS_HOST}/auth/realms/sunbird/protocol/openid-connect/token`,

}
const AUTH_FAIL = 'Authentication failed ! Please check credentials and try again.'
const AUTHENTICATED = 'Success ! User is sucessfully authenticated.'
const client = new OAuth2Client(CONSTANTS.GOOGLE_CLIENT_ID)
export const googleAuth = Router()
//tslint:disable-next-line: no-any
googleAuth.post('/callback', async (req:any, res:any) => {
    logInfo('Google auth callback called' )
    try {
        const { idToken } = req.body
        // tslint:disable-next-line: no-any
        let googleProfile: any = {}
        let isUserExist = {}
        let newUserDetails = {}
        const isTokenVerfiy = await client.verifyIdToken({
            audience: CONSTANTS.GOOGLE_CLIENT_ID,
            idToken,
        })
        if (isTokenVerfiy && isTokenVerfiy.getPayload()) {
                // tslint:disable-next-line: no-any
                const data: any = isTokenVerfiy.getPayload()
                logInfo('google user data', data )
                // tslint:disable-next-line: no-any
                googleProfile = {
                    emailId : data.email ,
                    name : data.name,
                }
        }
        logInfo('google profile ', googleProfile )
        console.log(JSON.stringify(googleProfile))
        isUserExist = await fetchUserByEmailId(googleProfile.emailId)
        if (!isUserExist) {
            logInfo('creating new google user')
            newUserDetails =  await createuserwithmailId(googleProfile).catch(handleCreateUserError)
            if (newUserDetails) {
                try {
                    const password = CONSTANTS.ES_PASSWORD
                    const username = googleProfile.emailId
                    const encodedData = qs.stringify({
                                                      client_id: 'portal',
                                                      client_secret: `${CONSTANTS.KEYCLOAK_CLIENT_SECRET}`,
                                                      grant_type: 'password',
                                                      password,
                                                      username,
                                                    })
                    logInfo('Entered into authorization part.' + encodedData)
                    const authTokenResponse = await axios({
                      ...axiosRequestConfig,
                      data: encodedData,
                      headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                      },
                      method: 'POST',
                      url: API_END_POINTS.generateToken,
                    })
                    if (authTokenResponse.data) {
                        const accessToken = authTokenResponse.data.access_token
                        logInfo('Entered into accesstoken :' + accessToken)
                        // tslint:disable-next-line: no-any
                        const decodedToken: any = jwt_decode(accessToken)
                        const decodedTokenArray = decodedToken.sub.split(':')
                        const userId = decodedTokenArray[decodedTokenArray.length - 1]
                        req.session.userId = userId
                        req.kauth = {grant: {access_token: {content:decodedToken, token : accessToken}}}
                        req.session.grant =  {access_token: {content:decodedToken, token : accessToken}}
                        logInfo('Success ! Entered into usertokenResponse..')
                        await getCurrentUserRoles(req, accessToken)
                        logInfo('Entered into updateRoles :' + JSON.stringify(req.session))
                        res.status(200).json({
                          msg: AUTHENTICATED,
                          status: 'success',
                        })
                      } else {
                        res.status(302).json({
                          msg: AUTH_FAIL,
                          status: 'error',
                        })
                      }
                } catch (error) {
                logInfo('Error in generating session : ' + error)
                    res.status(400).send({
                    error: AUTH_FAIL,
                 })
                }
               
            }
        } else {
            logInfo('Email already exists.')
            res.status(400).json({ status: 'error' , status_code: 400, msg: 'Email already exists.' })
            return
        }
    } catch (err) {
        res.status(401).send('Token Expired !!')
        logError('ERROR CREATING USER' + err )
    }

})

// tslint:disable-next-line: no-any
const handleCreateUserError = (error: any) => {
    logInfo('Error ocurred while creating user' + error)
    if (_.get(error, 'error.params')) {
      throw error.error.params
    } else if (error instanceof Error) {
      throw error.message
    } else {
      throw new Error('unhandled exception while getting userDetails')
    }
  }

// tslint:disable-next-line: no-any
const createuserwithmailId = async (accountDetails: any) => {
    if (!accountDetails.name || accountDetails.name === '') {
      throw new Error('USER_NAME_NOT_PRESENT')
    }
    try {
        const response = await axios( {
            ...axiosRequestConfig,
            data: {
                request: {
                  email: accountDetails.emailId,
                  emailVerified: true,
                  firstName: accountDetails.name,
                  lastname :  accountDetails.name,
                },
            },
            headers: {
                    Authorization: CONSTANTS.SB_API_KEY,
            },
            method: 'POST',
            url: API_END_POINTS.createUserWithMailId,

        })
        if (response.data.responseCode === 'OK') {
            logInfo( 'Log of createuser if OK :')
            return response.data
        } else {
            throw new Error(_.get(response.data, 'params.errmsg') || _.get(response.data, 'params.err'))
        }

    } catch (err) {
        logError( 'createUserWithMailId failed')
    }

  }
const fetchUserByEmailId = async (emailId: string) => {
    logInfo('Checking Fetch email id value : ', API_END_POINTS.fetchUserByEmailId + emailId)
    try {
        const response = await axios( {
            ...axiosRequestConfig,
            headers: {
                Authorization: CONSTANTS.SB_API_KEY,
            },
            method: 'GET',
            url: API_END_POINTS.fetchUserByEmailId + emailId,

        })
        logInfo( 'Response Data in JSON :', JSON.stringify(response.data))
        logInfo( 'Response Data in Success :', response.data.responseCode)
        if (response.data.responseCode === 'OK') {
            logInfo( 'Response result.exists :', _.get(response, 'data.result.exists'))
            return _.get(response, 'data.result.exists')
        }
    } catch (err) {
        logError( 'fetchUserByEmailId failed')
    }

  }
