const express = require('express')
const app = express()
const bodyParser = require('body-parser')

const cors = require('cors')

const mongoose = require('mongoose')
mongoose.connect(process.env.MLAB_URI || 'mongodb://localhost/exercise-track' )
const Schema = mongoose.Schema;

let userModel = mongoose.model('User', new Schema({
  username: {
    type: String,
    required: true
  },
  count: {
    type: Number,
    default: 0
  },
  log: [{
    description: String,
    duration: Number,
    date: Date
  }]
}));

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

app.post('/api/exercise/new-user', async (req, res, next) => {
  let username = req.body.username;
  //console.log(username);
  if(/^\w+$/.test(username)) {
    try {
      let userDoc = await userModel.findOne({username: username});
      if(userDoc) {
        next({status: 403, message: 'username already taken.'});
      } else {
        userDoc = await userModel.create({username: username, log: []});
        //console.log(userDoc);
        res.json({
          username: userDoc.username,
          _id: userDoc._id
        });
      }
      
    } catch(err) {
      console.log(err);
      next({status: 500, message: 'database error.'})
    }
  } else next({status: 400, message: 'username invalid.'})
})

function validateExercise(req, res, next) {
  if(!req.body.userId) {
    next({status: 400, message: 'unknown _id.'});
  } else 
    if(!(/^[0-9a-fA-F]{24}$/.test(req.body.userId)))
      next({status: 400, message: 'unknown _id.'});
  
  if(!req.body.description) {
    next({status: 400, message: 'Path `description` is required.'});
  }
  
  if(!req.body.duration) {
    next({status: 400, message: 'Path `duration` is required.'});
  }
  
  let description = req.body.description;
  let duration = Number(req.body.duration);
  let date = req.body.date ? (!Number.isNaN(Number(req.body.date)) ? new Date(Number(req.body.date)) : new Date(req.body.date)) : new Date();
  if(description.length > 20) {
    next({status: 400, message: 'description too long.'});
  }
  if(Number.isNaN(duration)) {
    next({status: 400, message: `Cast to Number failed for value "${req.body.duration}" at path "duration".`});
  }
  if(date == 'Invalid Date') {
    next({status: 400, message: `Cast to Date failed for value "${req.body.date}" at path "date".`});
  }
  //console.log(date);
  res.locals.exercise = {
    description,
    duration,
    date
  }
  next();
}

app.post('/api/exercise/add', validateExercise, async (req, res, next) => {
  try {
    let userDoc = await userModel.findOne({_id: req.body.userId});
    if(userDoc) {
      userDoc.log.push(res.locals.exercise);
      await userDoc.save();
      //console.log({...res.locals.exercise});
      res.json({
        username: userDoc.username,
        _id: userDoc._id,
        ...res.locals.exercise
      })
    } else next({status: 403, message: 'unknown _id.'});
  } catch(err) {
    console.log(err);
    next({status: 500, message: 'database error.'})
  }
})

app.get('/api/exercise/log', async (req, res, next) => {
  if(!req.query.userId) {
    next({status: 403, message: 'unknown userId.'});
  }
  else 
    if(/^[0-9a-fA-F]{24}$/.test(req.query.userId)){
      try {
        let userDoc = await userModel.findById(req.query.userId);
        if(!userDoc){
          next({status: 403, message: 'unknown userId.'});
        } else {
            //console.log(userDoc);
            let log = Array.from(userDoc.log);
            log = log.sort((a, b) => {
              return a.date - b.date;
            });

            if(req.query.from){
              let from = new Date(req.query.from);
              if(from != 'Invalid Date') {
                log = log.filter(e=> e.date >= from);
              }
            }

            if(req.query.to) {
              let to = new Date(req.query.to);
              if(to != 'Invalid Date') {
                log = log.filter(e => e.date <= to);
              }
            }

            if(req.query.limit) {
              let limit = Number(req.query.limit);
              if(!Number.isNaN(limit)) {
                log = log.slice(0, limit);
              }
            }

            res.json({
              username: userDoc.username,
              _id: userDoc._id,
              log: log
            });
        }
      } catch(err) {
        console.log(err);
        next({status: 500, message: 'database error.'})
      }
    } else next({status: 403, message: 'unknown userId.'});
  
  
})

// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})



const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
