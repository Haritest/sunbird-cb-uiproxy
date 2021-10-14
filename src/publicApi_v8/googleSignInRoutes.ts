import axios from 'axios'
import { Router } from 'express'
import { OAuth2Client } from 'google-auth-library'
import _ from 'lodash'
import { axiosRequestConfig } from '../configs/request.config'
import { CONSTANTS } from '../utils/env'
import { logError, logInfo } from '../utils/logger'
const API_END_POINTS = {
    createUserWithMailId: `${CONSTANTS.KONG_API_BASE}/user/v2/signup`,
   fetchUserByEmailId: `${CONSTANTS.KONG_API_BASE}/user/v2/exists/email/`,

}
const client = new OAuth2Client(CONSTANTS.GOOGLE_CLIENT_ID)
export const googleAuth = Router()

googleAuth.post('/callback', async (req,res) => {
    logInfo('google auth callback called' )
    try {
        console.log("IDtoken", req.body)
        const { idToken } = req.body
        await client.verifyIdToken({
            audience: CONSTANTS.GOOGLE_CLIENT_ID,
            idToken,
          }).then((response) => {
              console.log("Response 24 : ",response)
            if (response.getPayload()) {
                // tslint:disable-next-line: no-any
                const data: any = response.getPayload()
                // tslint:disable-next-line: no-any
                const googleProfile: any = {
                    emailId : data.email,
                    name : data.name,
                }
                
                console.log("Get payload", data)
                console.log("googleProfile.emailId", googleProfile.emailId)
                const isUserExist = fetchUserByEmailId(googleProfile.emailId)
                isUserExist.then((response)=>{
                    console.log(response);
                    if(!response){
                        createUserwithMailId(googleProfile, CONSTANTS.GOOGLE_CLIENT_ID)
                    }
                })
            } else {
                res.status(400).send('Fetched user profile failed')
                logInfo('Fetched user profile failed')
            }
          })
    } catch (err) {
        
        logError('ERROR CREATING USER>' +err )
    }

})
// tslint:disable-next-line: no-any
const createUserwithMailId = async (accountDetails: any, client_id: string) => {
    if (!accountDetails.name || accountDetails.name === '') {
      throw new Error('USER_NAME_NOT_PRESENT')
    }
    try {
        const response = await axios( {
            ...axiosRequestConfig,
            data: {
                body: {
                params: {
                  signupType: 'google',
                  source: client_id,
                },
                request: {
                  email: accountDetails.emailId,
                  emailVerified: true,
                  firstName: accountDetails.name,

                }},
            },
            headers: {
                    Authorization: CONSTANTS.SB_API_KEY,
            },
            method: 'POST',
            url: API_END_POINTS.createUserWithMailId,

        })
        if (response.data.responseCode === 'OK') {
            return response.data
        }
    } catch (err) {
        logError( 'createUserWithMailId failed')
    }

  }
const fetchUserByEmailId = async (emailId: string) => {
    console.log("FetchU 92 : ")
    try {
        const response = await axios( {
            ...axiosRequestConfig,
            headers: {
                Authorization: CONSTANTS.SB_API_KEY,
            },
            method: 'GET',
            url: API_END_POINTS.fetchUserByEmailId + emailId,

        })
        console.log("FetchUserfun : ",response.data)
        if (response.data.responseCode === 'OK') {
            return _.get(response, 'result.exists')
        }
    } catch (err) {
        logError( 'fetchUserByEmailId failed')
        console.log(err)
    }

  }
