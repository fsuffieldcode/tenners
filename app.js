// jshint esversion:6
require('dotenv').config()
const express = require("express")
const bodyParser = require("body-parser")
const ejs = require("ejs")
const mongoose = require("mongoose")
const session = require("express-session")
const passport = require("passport")
const SpotifyWebApi = require('spotify-web-api-node')

const passportLocalMongoose = require("passport-local-mongoose")

const port = process.env.PORT || 3000;

const connectionString = 'mongodb+srv://fabian:' + process.env.MONGO_PW + '@cluster0-26kcr.mongodb.net/tennersDB?retryWrites=true&w=majority'

const app = express()

app.use(express.static("public"))
app.set('view engine', 'ejs')
app.use(bodyParser.urlencoded({
    extended: true
}))

app.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false
}))


app.use(passport.initialize())
app.use(passport.session())

// Local Mongo

// mongoose.connect("mongodb://localhost:27017/tennersDB", { useNewUrlParser: true, useUnifiedTopology: true })
// mongoose.set('useCreateIndex', true);

// Cloud Mongo

mongoose.connect(connectionString, { useNewUrlParser: true, useUnifiedTopology: true })
mongoose.set('useCreateIndex', true);


const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    faveAlbums: [String]
})

userSchema.plugin(passportLocalMongoose)

const User = mongoose.model("User", userSchema)

passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


// SPOTIFY API INITIALISATION HERE

const spotifyApi = new SpotifyWebApi({
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    redirectUri: 'https://tenners.herokuapp.com' || 'https://localhost:3000'
});

// Retrieve an access token
spotifyApi.clientCredentialsGrant().then(
    function (data) {
        console.log('The access token expires in ' + data.body['expires_in']);
        console.log('The access token is ' + data.body['access_token']);
        
        // Save the access token so that it's used in future calls
        spotifyApi.setAccessToken(data.body['access_token']);
    },
    function (err) {
        console.log('Something went wrong when retrieving an access token', err);
    }
);


//  GET ROUTES


app.get("/", function (req, res) {
    if (req.isAuthenticated()) {
        res.render("home")
    } else {
        res.render("landing")
    }
})

app.get("/login", function (req, res) {
    if (req.isAuthenticated()) {
        res.redirect("/home")
    } else {
        res.render("login")
    }
})

app.get("/register", function (req, res) {
    if (req.isAuthenticated()) {
        res.redirect("/home")
    } else {
        res.render("register")
    }
})

app.get("/home", function (req, res) {
    if (req.isAuthenticated()) {
        res.render("home")
    } else {
        res.redirect("/login")
    }
})

app.get("/search", function (req, res) {
    res.render('search')
})

app.get("/logout", function (req, res) {
    req.logout();
    res.redirect('/');
})

// POST ROUTES

app.post("/register", function (req, res) {

    User.register({ username: req.body.username }, req.body.password, function (err, user) {
        if (err) {
            res.redirect("/register")
        } else {
            passport.authenticate("local")(req, res, function () {
                res.redirect("/home")
            })
        }
    })
})

app.post("/login", function (req, res) {

    const user = new User({
        username: req.body.username,
        password: req.body.password
    })

    req.login(user, function (err) {
        if (err) {
            console.log(err)
        } else {
            passport.authenticate("local")(req, res, function () {
                res.redirect("/home")
            })
        }
    })
})

app.post("/artist-search", function (req, res) {
    spotifyApi
        .searchArtists(req.body.artist)
        .then(data => {
            res.render('artist-search-results', { searchResults: data.body })
        })
        .catch(err => console.log('The error while searching artists occurred: ', err));
})

app.get('/albums/:artistId', (req, res, next) => {

    console.log('Artist ID passed: ' + req.params.artistId)

    

    spotifyApi
        .getArtistAlbums(req.params.artistId)
        .then(function (data) {
            res.render('albums', {
                artist: data.body.items[0].artists[0].name,
                albums: data.body.items
            })
        },
            function (err) {
                console.error(err);
            }
        );

});


app.get('/add/:albumId', (req, res) => {
    req.user.faveAlbums.push(req.params.albumId)
    req.user.save()
    res.redirect('/home')
})



app.listen(port, () => console.log('Tenners running on ' + port + ' 🎧 🥁 🎸 🔊'));