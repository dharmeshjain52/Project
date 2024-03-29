import jwt from 'jsonwebtoken'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/Apierror.js'
import { User } from '../models/user.models.js'

export const verifyJWT=asyncHandler(async(req,_,next)=>{
   try {
     const accessToken = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ","")
     
     if(!accessToken){
         throw new ApiError(400,"Unauthorized Access")
     }
 
     const decodedToken = jwt.verify(accessToken,process.env.ACCESS_TOKEN_SECRET)
 
     const user = await User.findById(decodedToken?._id).select("-password -refreshToken")
 
     if(!user){
         throw new ApiError(401,"Invalid Access Token")
     }
 
     req.user=user
     next()
   } catch (error) {
    throw new ApiError(401,error?.message || "Invalid Access Token")
   }
})