import {asyncHandler} from '../utils/asyncHandler.js'
import { ApiError } from '../utils/Apierror.js'
import { User } from '../models/user.models.js'
import {uploadOnCloudinary} from '../utils/cloudinaryfileupload.js'
import { ApiResponse } from '../utils/Apiresponse.js'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
//generate access and refresh tokens
const generateRefreshAndAccessTokens=async(userId)=>{
   try {
   const user = await User.findById(userId)
   //call functions
   const refreshToken = user.generateRefreshToken()
   const accessToken = user.generateAccessToken()
   //saving refreshtoken to database
   user.refreshToken=refreshToken
   await user.save({validateBeforeSave:false})
   //return
   return{refreshToken,accessToken}
   } catch (error) {
      throw new ApiError(500,"Something went Wrong while generating refresh and access Tokens")
   }

}

const userRegister = asyncHandler(async(req,res)=>{
   const {username,email,fullName,password}=req.body
   if ([username,email,fullName].some((field)=>field?.trim()==="")) {
    throw new ApiError(400,"All Fields are required")
   }
   //check existing user
   const userExists=await User.findOne({
    $or:[{ username },{ email }]
   })
   if(userExists){
    throw new ApiError(409,"username or email exists")
   }
   //avatar and coverimage validation and upload
   const avatarLocalPath=req.files?.avatar[0]?.path
   //validation
   let coverImageLocalPath
   if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length >0) {
       coverImageLocalPath=req.files.coverImage[0].path
   }

   if(!avatarLocalPath){
      throw new ApiError(400,"Avatar Required")
   }
   //upload
   const avatarUpload=await uploadOnCloudinary(avatarLocalPath)
   const coverImageUpload=await uploadOnCloudinary(coverImageLocalPath)


   if(!avatarUpload){
      throw new ApiError(400,"Avatar Required")
   }
   //create user object
   const user = await User.create({
      username:username.toLowerCase(),
      fullName,
      email,
      password,
      avatar:avatarUpload.url,
      coverImage:coverImageUpload?.url || ""
   })
   const userCreated = await User.findById(user._id).select("-password -refreshToken")
   if(!userCreated){
      throw new ApiError(500,"Something went wrong while registering the user")
   }
   //return response
   return res.status(201).json(
      new ApiResponse(200,userCreated,"User Regsitered Successfully") 
   )

})

const userLogin=asyncHandler(async(req,res)=>{
   const{username,email,password}=req.body
   if(!username && !email) {
      throw new ApiError(400,"Username or Email is required")
   }
   //Searching user
   const enteredUser = await User.findOne({
      $or:[{username},{email}]
   })

   if(!enteredUser){
      throw new ApiError(404,"User not Found")
   }
   //validating password
   const isPasswordValid = await enteredUser.isPasswordCorrect(password)

   if(!isPasswordValid){
      throw new ApiError(401,"Password is not valid")
   }
   const{refreshToken,accessToken}=await generateRefreshAndAccessTokens(enteredUser._id)

   const loggedInUser = await User.findById(enteredUser._id).select("-password -refreshToken")

   const options={
      httpOnly:true,
      secure:true
   }

   return res
   .status(200)
   .cookie("refreshToken",refreshToken,options)
   .cookie("accessToken",accessToken,options)
   .json(
      new ApiResponse(200,loggedInUser,"Logged In")
   )

})

const userLogOut = asyncHandler(async(req,res)=>{
   await User.findByIdAndUpdate(
      req.user._id,
      {
         $unset:{
            refreshToken:1
         }
      },
      {
         new:true
      }
   )
   
   const options={
      httpOnly:true,
      secure:true
   }
   return res
   .status(200)
   .clearCookie("accessToken",options) 
   .clearCookie("refreshToken",options)
   .json(
      new ApiResponse(200,{},"User logged Out")
   )
})

const refreshAccessToken=asyncHandler(async(req,res)=>{
   const inputrefreshToken=req.cookies.refreshToken || req.body.refreshToken

   if(!inputrefreshToken){
      throw new ApiError(400,"Couldn't fetch refresh token")
   }

   const decodedToken = jwt.verify(inputrefreshToken,process.env.REFRESH_TOKEN_SECRET)

   const user = await User.findById(decodedToken._id)

   if(!user){
      throw new ApiError(400,"Refresh Token Inavlid")
   }

   if(inputrefreshToken !== user?.refreshToken){
      throw new ApiError(401,"Refresh Token Inavlid or already used")
   }

   const {refreshToken,accessToken}=await generateRefreshAndAccessTokens(user._id)

   const options={
      httpOnly:true,
      secure:true
   }
   return res
   .status(200)
   .cookie("refreshToken",refreshToken,options)
   .cookie("accessToken",accessToken,options)
   .json(
      new ApiResponse(200,{},"New refresh and access token generated")
   )
})

const changePassword = asyncHandler(async(req,res)=>{
   const {oldPassword,newPassword} = req.body 
   //find user
   const user=await User.findById(req.user?._id)
   if(!user){
      throw new ApiError(400,"Invalid user")
   }
   //check password
   const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
   if(!isPasswordCorrect){
      throw new ApiError(400,"Invalid old Password")
   }
   //set new Password
   user.password = newPassword
   await user.save({validateBeforeSave:false})

   return res
   .status(200)
   .json(
      new ApiResponse(200,"Password Reset Successfully")
   )
})

const getCurrentUser=asyncHandler(async(req,res)=>{
   return res
   .status(200)
   .json(200,req.user,"Current user")
})

const updateInfo = asyncHandler(async(req,res)=>{
   const {fullName,email}=req.body
   //validate
   if(!fullName && !email){
      throw new ApiError(400,"Enter Details")
   }
   //find and update
   const user = await User.findByIdAndUpdate(req.user?._id,{
      $set:{
         fullName,
         email
      }
   },{new:true}).select("-password")

   return res
   .status(200)
   .json(
      new ApiResponse(200,user,"Details updated successfully")
   )
})

const updateAvatar=asyncHandler(async(req,res) => {
   const avatarLocalPath=req.file?.path
   //validate
   if(!avatarLocalPath){
      throw new ApiError(400,"Avatar file is missing")
   }
   //upload on cloudinary
   const avatar = await uploadOnCloudinary(avatarLocalPath)
   if(!avatar.url){
      throw new ApiError(400,"Error while uploading on cloudinary")
   }
   const user = await User.findByIdAndUpdate(
      req.user._id,
      {
         $set:{
            avatar:avatar.url
         }
      },{new:true}
   ).select("-password")
   return res
   .status(200)
   .json(
      new ApiResponse(200,"avatar updated successfully")
   )
})

const updateCoverImage=asyncHandler(async(req,res) => {
   const coverImageLocalPath=req.file?.path
   //validate
   if(!coverImageLocalPath){
      throw new ApiError(400,"cover image file is missing")
   }
   //upload on cloudinary
   const coverImage = await uploadOnCloudinary(coverImageLocalPath)
   if(!coverImage.url){
      throw new ApiError(400,"Error while uploading on cloudinary")
   }
   const user = await User.findByIdAndUpdate(
      req.user._id,
      {
         $set:{
            coverImage : coverImage.url
         }
      },{new:true}
   ).select("-password")
   return res
   .status(200)
   .json(
      new ApiResponse(200,"cover image updated successfully")
   )
})

const getUserChannelProfile = asyncHandler(async(req,res)=>{
   //get username
   const {username} = req.params
   if(!username){
      throw new ApiError(400,"Username Missing")
   }
   //aggregation pipelining
   const channel = await User.aggregate([
      {
         $match:{
            username:username?.toLowerCase()
         }
      },
      {
         $lookup:{
            from:"subscriptions",
            localField:"_id",
            foreignField:"channel",
            as:"subscribers"
         }
      },
      {
         $lookup:{
            from:"subscriptions",
            localField:"_id",
            foreignField:"subscription",
            as:"subscribedto"
         }
      },
      {
         $addFields:{
            subscribersCount:{
               $size:"$subscribers"
            },
            subscribedToCount:{
               $size:"$subscribedto"
            },
            isSubscribed:{
              $cond: {
               if:{$in:[req.user?._id,"$subscribers.subscriber"]},
               then:true,
               else:false
            }
          }
         }
      },
      {
         $project:{
            fullName:1,
            username:1,
            subscribersCount:1,
            subscribedToCount:1,
            email:1,
            avatar:1,
            coverImage:1
         }
      }
   ])
   if(!channel?.length){
      throw new ApiError(400,"Channel does not exist")
   }

   return res
   .status(200)
   .json(
      new ApiResponse(200,channel[0],"user details fetched successfully")
   )
})

const getUserWatchHistory = asyncHandler(async(req,res)=>{
   const getWatchHistory = await User.aggregate([
      {
         $match:{
            _id: new  mongoose.Types.ObjectId(req.user._id)
         }
      },
      {
         $lookup:{
            from:"videos",
            localField:"watchHistory",
            foreignField:"_id",
            as:"watchHistory",
            pipeline:[
               {
                  $lookup:{
                     from:"users",
                     localField:"owner",
                     foreignField:"_id",
                     as:"owner",
                     pipeline:[
                        {
                           $project:{
                              fullName:1,
                              username:1,
                              avatar:1
                           }
                        }
                     ]
                  },
               }
            ]
         }
      },
      {
         $addFields:{
            owner:{
               $first:"$owner"
               }  
         }
      }
   ])
   return res
   .status(200)
   .json(
      new ApiResponse(200,getWatchHistory[0].watchHistory,"watch history fetched")
   )
})
export {
   userRegister,
   userLogin,
   userLogOut,
   refreshAccessToken,
   changePassword,
   getCurrentUser,
   updateInfo,
   updateAvatar,
   updateCoverImage,
   getUserChannelProfile,
   getUserWatchHistory
}