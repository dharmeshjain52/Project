import {v2 as cloudinary} from 'cloudinary';
import fs from 'fs'       
cloudinary.config({ 
  cloud_name:process.env.CLOUDINARY_CLOUD_NAME , 
  api_key:process.env.CLOUDINARY_API_KEY, 
  api_secret:process.env.CLOUDINARY_API_SECRET 
});

const uploadOnCloudinary=async (localpath)=>
{
    try {
    if(!localpath) return null;
    const upload=await cloudinary.uploader.upload(localpath,{
        resource_type:'auto'
    })
    fs.unlinkSync(localpath)
    return upload
    } 
    catch (error) {
         fs.unlinkSync(localpath)  
         return null 
    }
}

const deleteOnCloudinary = async(public_id) =>
{
  try {
    await cloudinary.uploader.destroy(public_id)
  } catch (error) {
    console.error(error)
  }
}

const deleteVideoOnCloudinary = async (public_id) =>
{
  try {
    await cloudinary.uploader.destroy(public_id,{resource_type:'video'})
  } catch (error) {
    
  }
}

export {uploadOnCloudinary,deleteOnCloudinary,deleteVideoOnCloudinary}