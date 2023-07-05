import axios from "axios";
import {faker} from "@faker-js/faker";

const express = require("express");
const fs = require("fs");

const app = express();
const port : number = 8000;
const API_KEY : string = "w79BVY7YHOsF11hE0SJXVzWc35B5aCTI4Pb8gOuO";
const CORS = require("cors");

app.use(express.json());
app.use(CORS());

const router = express.Router();
router.get('/test', (request : any, response : any) => response.send("Hello world!"));
app.use("/", router);

const db = require("knex")( {
    client: "pg",
    connection: {
        host: "localhost",
        user: "postgres",
        password: "pami",
        database: "knex-test",
        port: 5432
    }
});


app.set("db", db);

interface Rover {
    id : number,
    name: string,
    status: string,
    landing_date: string,
    launch_date: string;
    cameras: string[]
};

enum CameraType {
    FHAZ = "FHAZ",
    RHAZ = "RHAZ",
    MAST = "MAST",
    CHEMCAM = "CHEMCAM",
    MAHLI = "MAHLI",
    MARDI = "MARDI",
    NAVCAM = "NAVCAM",
    PANCAM = "PANCAM",
    MINITES = "MINITES"
};

interface Photo {
    id : number,
    src : string;
    camera : CameraType;
};

/*router.get("/seed", function(req : any, res : any, next : any) {
    const db = req.app.get("db");
    db.schema.hasTable("rovers").then(function (exists : any) {
        if (!exists) {
            db.schema
                .createTable("rovers", function(table : any) {
                    table.increments("id").primary();
                    table.string("name").notNullable();
                    table.string("status").notNullable();
                })
                .then(function() {
                    const records = [ {"name": "Curiosity", "status": "active"} ];
                    db("rovers")
                        .insert(records)
                        .then(() => {
                            res.send("Seeded data");
                        });
                });
        }
    })
});*/


router.get("/rovers", (request : any, response : any) : void => {
    axios.get(`https://api.nasa.gov/mars-photos/api/v1/rovers/?api_key=${API_KEY}`)
        .then(function(API_RESPONSE : any) : void {
            const JSON_RES : Rover[] = [];
            Array.from(API_RESPONSE.data.rovers).forEach(function (rover : any) : void {
                JSON_RES.push( {id : rover.id, name: rover.name, status: rover.status, landing_date: rover.landing_date, launch_date: rover.launch_date,
                    cameras: rover.cameras.map((roverEntry : Rover) => roverEntry.name)});
            })
            response.send(JSON_RES);
        });
});

router.get("/db/rovers", function(req : any, res : any, next : any) {
    const db = req.app.get('db');
    db.schema.hasTable("rovers")
        .then(function (exists: boolean): void {
            if (!exists) {
                db.schema
                    .createTable("rovers", function(table : any) {
                        table.increments("id").primary();
                        table.string("name").notNullable();
                        table.string("status").notNullable();
                        table.date("landing_date").notNullable();
                        table.date("launch_date").notNullable();
                    })
                    .then(async function() {
                        axios.get("http://localhost:8000/rovers")
                            .then((rovers : any) => {
                                db("rovers").insert(rovers);
                                res.send(JSON.stringify(rovers));
                            })
                    })
            } else {
                axios.get("http://localhost:8000/rovers")
                    .then((rovers : any) : void => {
                        db("rovers").insert(rovers);
                    })
                    .then(function() : void {
                       res.send(JSON.stringify(db
                           .from("rovers")
                           .select("*")));
                    });
            }
        })
})
router.get("/seed", function(req : any, res : any, next : any) {
    const db = req.app.get('db');
    db.schema.hasTable("users-data").then(function(exists : boolean) {
        if (!exists) {
            db.schema
                .createTable("users-data", function(table : any) {
                    table.increments("id").primary();
                    table.string("name");
                    table.string("email");
                })
                .then(function() {
                    const recordsLength = Array.from(Array(100).keys());
                    const records = recordsLength.map(rec => ({
                        name: faker.person.firstName() + " " + faker.person.lastName(),
                        email: faker.internet.email()
                    }));
                    db("users-data")
                        .insert(records)
                        .then(() => {
                            res.send(records);
                        });
                });
        } else {
            db.select("*")
                .from("users-data")
                .then((rows : any) => res.send(rows));
        }
    });
});


function checkIfCameraIsValid(cameraName : any) : void {
    if (!Object.values(CameraType).includes(cameraName)) {
        throw new Error("Invalid Camera Type specified in query: " + cameraName);
    }
}

function processPhotos(Response : any, goLive : boolean = true) : Photo[] {
    const JSON_RES : Photo[] = [];
    if (goLive) {
        Array.from(Response.data.photos).forEach(function (photo : any) : void {
            try {
                checkIfCameraIsValid(photo.camera.name);
                JSON_RES.push({id: photo.id, src: photo.img_src, camera: photo.camera.name});
                console.log(JSON_RES);
            } catch (invalidTypeError) {
                console.log(invalidTypeError);
            }
        });
    } else {
        Array.from(Response).forEach(function (photo: any): void {
            try {
                JSON_RES.push({id: photo.id, src: photo.img_src, camera: CameraType.NAVCAM});
            } catch (invalidTypeError) {
                console.log(invalidTypeError);
            }
        });
    }
    return JSON_RES;
}
function makeAxiosGetReqForPhotos(urlReq : string, request : any, response : any, goLive : boolean = true) : void {
    if (goLive) {
        axios.get(urlReq)
            .then(function(API_RESPONSE : any) : void {
                response.send(processPhotos(API_RESPONSE));
            })
            .catch(() : void => {
                console.log("Timeout");
            });
    } else {
        let newString : string = "resources/" + urlReq.substring(8) + ".txt";
        newString =  newString.replace("?", "Q");
        newString = newString.replace("&", "A");
        newString = newString.replace("=", "-");
        console.log(newString);
        response.send(processPhotos(JSON.parse(fs.readFileSync(newString, {encoding: "utf-8"}))));
    }
}

function getUrlWithAppendedPage(url : string, page : number) : string {
    return url + `&page=${page}`;
}
function makeAxiosGetReqForOnePage(url : string, page : number, request : any, response : any) : void {
    makeAxiosGetReqForPhotos(getUrlWithAppendedPage(url, page), request, response);
}

function makeAxiosGetReqForPageRange(url : string, request: any, response : any) : void {
    let pageStart : number = request.query["pageStart"];
    let pageEnd : number = request.query["pageEnd"];
    let pageDef : number = request.query["page"];
    if (pageStart !== undefined) {
        if (pageEnd === undefined) {
            makeAxiosGetReqForOnePage(url, (pageDef === undefined ? 1 : pageDef), request, response); // default page argument = 1;
        } else {
            let endpoints : Array<string> = [];
            for (let page : number = pageStart; page <= pageEnd; ++page) {
                endpoints.push(getUrlWithAppendedPage(url, page));
/*
                makeAxiosGetReqForOnePage(url, page, request, response);
*/
            }

            let photoGallery : Photo[] = [];
            axios.all(endpoints.map((endpoint: string ): void => {
                axios.get(endpoint)
                    .then(function (API_RESPONSE: any): void {
                        let photoRes : Photo[] = processPhotos(API_RESPONSE);
                        console.log(photoRes);
                        photoGallery.push(...photoRes);
                    })
                    .catch((e): void => {
                        console.log(e);
                    })
            })).then(() => response.send(photoGallery)).catch((e) => console.log(e));
        }
    } else if (pageDef !== undefined) {
        makeAxiosGetReqForOnePage(url, pageDef, request, response);
    } else {
        makeAxiosGetReqForOnePage(url, 1, request, response); // default page argument = 1;
    }
}

router.get("/rovers/:rover/photos/:camera/:sol", (request : any, response : any) : void => {
    const requestURL : string = `https://api.nasa.gov/mars-photos/api/v1/rovers/${request.params["rover"]}/photos?sol=${request.params["sol"]}&camera=${request.params["camera"]}&api_key=${API_KEY}`;
    makeAxiosGetReqForPageRange(requestURL, request, response);
});

router.get("/rovers/:rover/photos/:camera/:earth_date", (request : any, response : any) : void => {
    const requestURL : string = `https://api.nasa.gov/mars-photos/api/v1/rovers/${request.params["rover"]}/photos?earth_date=${request.params["earth_date"]}&camera=${request.params["camera"]}&api_key=${API_KEY}`;
    makeAxiosGetReqForPageRange(requestURL, request, response);
});


router.get("/rovers/:rover/photos/", (request : any, response : any) : void => {
    try {
        const camera : CameraType = request.body.camera;
        checkIfCameraIsValid(camera);
        if (request.body?.sol && request.body?.earth_date) {
            throw new Error("Can't query for both sol and earth_date" + request.body);
        } else if (request.body?.sol) {
            const requestURL : string = `https://api.nasa.gov/mars-photos/api/v1/rovers/${request.params["rover"]}/photos?sol=${request.body.sol}&camera=${request.body.camera}&api_key=${API_KEY}`;
            makeAxiosGetReqForPageRange(requestURL, request, response);
        } else if (request.body?.earth_date) {
            const requestURL : string = `https://api.nasa.gov/mars-photos/api/v1/rovers/${request.params["rover"]}/photos?earth_date=${request.body["earth_date"]}&camera=${request.body.camera}&api_key=${API_KEY}`;
            makeAxiosGetReqForPageRange(requestURL, request, response);
        } else {
            throw new Error("Have to query photo with either sol or earth_date option!" + request.body);
        }
    } catch (error) {
        console.log(error);
    }
});

app.listen(port, () : void => {
    console.log("Test backend is running on port " + port);
});