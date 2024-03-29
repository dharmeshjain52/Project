import mongoose from "mongoose";
import {DB_NAME} from '../constants.js'

const connectDB=async ()=>{
    try {
        const connectionInstance=await mongoose.connect(`${process.env.DB_URL}/${DB_NAME}`)
        console.log(`\nDATABASE CONNECTED !! DB_HOST:${connectionInstance.connection.host}`)
    } catch (error) {
        console.log("MONGODB CONNECTION ERROR",error)
        process.exit(1)
    }
}

export default connectDB