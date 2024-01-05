import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";
import pgPromise, {ParameterizedQuery} from "pg-promise";
import morgan from "morgan";

export interface TypedRequestBody<T> extends express.Request{
  body:T
}


dotenv.config();

const dbport = parseInt(process.env.PGPORT || "5432",10);

const config = {
    database: process.env.PGDATABASE || "postgres",
    host: process.env.PGHOST || "localhost",
    dbport,
    user : process.env.PGUSER || "postgres"
};

const pgp  = pgPromise();
const db = pgp(config);


const app: Express = express();
app.use(morgan('dev'))
const port = process.env.SERVER_PORT || 3000;

app.use((req,res,next)=>{
  res.header('Access-Control-Allow-Origin','*');
  res.header('Access-Control-Allow-Headers','origin,X-Requested-With,Content-Type,Accept,Authorization');
  if(req.method === 'OPTIONS'){
      res.header('Access-Control-Allow-Methods','GET,PATCH,DELETE,POST,PUT');
      return res.status(200).json({});
  }
  next();
});

app.get("/", (req: Request, res: Response) => {
  res.send("Express + TypeScript Server");
});

  // documents
app.get('/api/documents/all',async(req:any, res) => {
    try{
            const userId = 1;
            const documents = await db.any('SELECT * FROM documents order by documentnumber',);
            return res.json(documents);
        } catch (err:any){
            // tslint:disable-next-line:no-console
            console.error(err);
            res.json({error: err.message || err});
    }
});

app.get('/api/documents/getdocumentsbyuserid/:userid',async(req:any,res)=>{
  const query:string = `SELECT u.userid,u.documentid as userStateid,d.doc_id as doc_id,d.documentcode,d.documentname,u.usercurrentrevision,u.rev,d.risklevel FROM public.user_training_needed u inner join documents d on CAST(d.doc_id as INTEGER) = u.documentid where u.userid = ${req.params.userid};`
  const documentsbyuserid = await db.any(query,);
  return(res.json(documentsbyuserid));
});

app.get('/api/documents/gettrainingupdates', async (req:any,res)=>{
  const query:string = 'select * from user_training_needed';
  const trainingneeded = await db.any(query,);
  return(res.json(trainingneeded));
});

app.get('/api/users/all',async(req:any,res)=>{
  try{
      let sql:string  = 'Select distinct t.name,tm.team_id as TEAM_id,u.id as userid,u.username,jt.name,tm.user_is_manager as manager from users u ';
      sql = sql + 'inner join team_members tm on tm.user_id = u.id ';
      sql = sql + 'left join teams t on t.id = tm.team_id ';
      sql = sql + 'left join user_jobtitle uj ON uj.user_id = u.id ';
      sql = sql + 'left join job_titles jt on jt.id = uj.job_title_id ';
      sql = sql + 'order by tm.user_is_manager DESC ,u.username ';
      const users = await db.any(sql);
      return res.json(users);
  } catch(err) {
      return res.json(err)
  }
});



/*Get TEAM MEMBERS BASED ON MANAGER ID
select u.id,u.username,u.email_address,jt.name AS job_title
from users u
inner join orgchart o on o.user_id = u.id
inner join user_jobtitle uj ON uj.user_id = o.user_id
inner join job_titles jt on jt.id = uj.job_title_id
where o.manager_id = 21
*/

app.get('/api/users/getmanageruserdetails/:managerid',async (req:any,res)=>{
let sql = 'select u.id,u.username,u.email_address,jt.name AS job_title from users u ';
sql = sql + 'inner join orgchart o on o.user_id = u.id ';
sql = sql + 'inner join user_jobtitle uj ON uj.user_id = o.user_id ';
sql = sql + 'inner join job_titles jt on jt.id = uj.job_title_id ';
sql = sql + 'where o.manager_id ='+req.params.managerid;

const user = await db.any(sql,);
return res.json(user);
});

/*
--Get TEAM MEMBERS BASED ON TEAM ID
Select t.name,u.id as userid,u.username,jt.name,tm.user_is_manager as manager
from users u
inner join team_members tm on tm.user_id = u.id
inner join teams t on t.id = tm.team_id
inner join user_jobtitle uj ON uj.user_id = u.id
inner join job_titles jt on jt.id = uj.job_title_id
where t.id =
order by tm.user_is_manager DESC ,u.id
*/

app.get('/api/users/getteammembers/:teamid',async (req:any,res)=>{
let sql = 'Select distinct t.name as teamname,t.id as team_id,u.id as userid,u.username,jt.name as jobtitle,tm.user_is_manager as manager from users u ';
sql = sql + 'inner join team_members tm on tm.user_id = u.id ';
sql = sql + 'inner join teams t on t.id = tm.team_id ';
sql = sql + 'left join user_jobtitle uj ON uj.user_id = u.id ';
sql = sql + 'left join job_titles jt on jt.id = uj.job_title_id ';
sql = sql + `where t.id = ${req.params.teamid} `;
sql = sql + 'order by tm.user_is_manager DESC ,u.id'

try{
  const user = await db.any(sql,);
  return res.json(user);
}
catch(e)
{
  res.json(e).status(400);
}
});

app.get('/api/users/removefromteam/:userid', async(req:any,res) => {
try{
  console.log(JSON.stringify(req.params))
  const result = db.any(`update team_members set team_id = -1 where user_id = ${req.params.userid}`,);
}catch (err){
  res.json(err).status(400)
}
});

/*GET ALL DOCUMENTS FOR A USER INCLUDE TRAINING LEVEL
select distinct u.ID,U.username,U.email_address,t.name,d.doc_id,d.documentname,d.documentnumber,UT.usercurrentrevision,UT.rev
from users u
inner join orgchart o on o.user_id = u.id
inner join team_members tm on tm.user_id = u.id
inner join teams t on tm.team_id = t.id
inner join user_jobtitle uj on uj.user_id = u.id
inner join job_documents jd on jd.job_id = uj.job_title_id
LEFT join documents d on CAST(d.doc_id as integer) = CAST(jd.doc_id as integer)
LEFT JOIN USER_TRAINING_NEEDED UT ON UT.documentqtid = D.documentnumber AND UT.userid = U.ID
where u.id = 35
order by u.id,d.do
*/


app.get('/api/users/getusertrainingdetails/:userid',async (req:any,res)=>{
let sql = ' SELECT distinct u.ID as userid,U.username,U.email_address,t.name as team_name,jt.name as job_title,d.doc_id,d.documentname,d.documentnumber,UT.usercurrentrevision,UT.rev from users u ';
sql = sql + 'inner join orgchart o on o.user_id = u.id ';
sql = sql + 'inner join team_members tm on tm.user_id = u.id ';
sql = sql + 'inner join teams t on tm.team_id = t.id ';
sql = sql + 'inner join user_jobtitle uj on uj.user_id = u.id ';
sql = sql + 'inner join job_titles jt on jt.id = uj.job_title_id ';
sql = sql + 'inner join job_documents jd on jd.job_id = uj.job_title_id ';
sql = sql + 'LEFT join documents d on CAST(d.doc_id as integer) = CAST(jd.doc_id as integer) ';
sql = sql + 'LEFT JOIN USER_TRAINING_NEEDED UT ON UT.documentqtid = D.documentnumber AND UT.userid = U.ID ';
sql = sql + `where u.id = ${req.params.userid} `;
sql = sql + 'order by u.id,d.doc_id;';

const user = await db.any(sql,);
return res.json(user);
});

/* GET ALL JOB Documents

select distinct t.id as team_id,t.name as team_name,jt.id as Job_id,jt.name as job_title,d.doc_id,d.documentnumber,d.documentname
from job_titles  jt
inner join  job_documents jd on jt.id = jd.job_id
inner join documents d on  CAST(jd.doc_id as integer) = CAST(d.doc_id as integer)
inner join teams t on t.id = jt.team_id
where jt.id = 4*/

app.get('/api/users/getjobdocuments/:jobid',async (req:any,res)=>{
let sql = ' select distinct t.id as team_id,t.name as team_name,jt.id as Job_id,jt.name as job_title,d.doc_id,d.documentnumber,d.documentname from job_titles jt ';
sql = sql + 'inner join job_documents jd on jt.id = jd.job_id ';
sql = sql + 'inner join documents d on  CAST(jd.doc_id as integer) = CAST(d.doc_id as integer) ';
sql = sql + 'inner join teams t on t.id = jt.team_id ';
sql = sql + `where jt.id = ${req.params.jobid} `;
sql = sql + 'order by d.doc_id;';

const user = await db.any(sql,);
return res.json(user);
});

/* Select t.name,tm.team_id as TEAM_id,u.id as userid,u.username,u.firstname,u.surname,jt.id,jt.name,tm.user_is_manager as manager
from users u
inner join team_members tm on tm.user_id = u.id
left join teams t on t.id = tm.team_id
left join user_jobtitle uj ON uj.user_id = u.id
left join job_titles jt on jt.id = uj.job_title_id
where u.id = 21 */

app.get('/api/users/user/:userid',async (req:any, res)=>{
      let sql:string = 'Select t.name,tm.team_id as TEAM_id,u.id as userid,u.username,u.firstname,u.surname,jt.id as job_id,jt.name,tm.user_is_manager as manager from users u ';
      sql = sql + 'inner join team_members tm on tm.user_id = u.id ';
      sql = sql + 'left join teams t on t.id = tm.team_id ';
      sql = sql + 'left join user_jobtitle uj ON uj.user_id = u.id ';
      sql = sql + 'left join job_titles jt on jt.id = uj.job_title_id ';
      sql = sql + `where u.id = ${req.params.userid}`;
      const user = await db.any(sql,);
      return res.json(user);
});
/*
select distinct u.*,t.name,t.id,jt.name
from users u
inner join orgchart o on o.manager_id = u.id
left join team_members tm on tm.user_id = u.id
left join teams t on t.id = tm.team_id
left join user_jobtitle ut on ut.user_id = u.id
left join job_titles jt on jt.id = ut.job_title_id
order by u.surname; */

app.get('/api/users/getmanagerlist',async (req:Request,res:any) => {
  let sql= 'select distinct u.*,t.name as teamname,t.id as teamid,jt.name as jobtitle from users u';
  sql = sql + ' inner join orgchart o on o.manager_id = u.id';
  sql = sql + ' left join team_members tm on tm.user_id = u.id';
  sql = sql + ' left join teams t on t.id = tm.team_id';
  sql = sql + ' left join user_jobtitle ut on ut.user_id = u.id';
  sql = sql + ' left join job_titles jt on jt.id = ut.job_title_id';
  sql = sql + ' order by u.surname;';
  try{
          const result = await db.query(sql,);
          return res.json(result);
  } catch(e){
          res.json(e).status(400);
  }
});

app.get('/api/users/getmanagers',async (req:express.Request,res: { json: (arg0: any[]) => any; })=>{
  const result = await db.any(`select distinct u.* from users u inner join orgchart o on o.manager_id = u.id order by u.surname;`);
  return res.json(result);
});

app.get('/api/users/getmanagersreports/:managerid',async (req:express.Request,res) => {
  const result = await db.any(`select u.id,u.username from users u inner join orgchart o on u.id = o.user_id where o.manager_id = ${req.params.managerid}`);
  return res.json(result);
});


app.get('/api/users/getusersmanager/:userid', async (req:any,res)=>{
  const manager = await db.any(`select u.* from orgchart o inner join users u on o.manager_id = u.id where user_id= ${req.params.userid}`,);
  return res.json(manager);
});


// roles

// get

app.get('/api/team/roles/all', async(req:any,res) =>{
  const sql:string = `select distinct * from job_titles;`;
  const roles = await db.any(sql,);
  return res.json(roles);
});

app.get('/api/team/roles/:teamid', async(req:any,res) =>{
  const sql:string = `select distinct * from job_titles where team_id =${req.params.teamid};`;
  const roles = await db.any(sql,);
  return res.json(roles);
});


// teams

app.get('/api/team/getname/:teamid',async(req:any,res:any) =>{
  console.log(JSON.stringify(req.params));
  const teamname = await db.any(`select distinct id,name from teams where id = ${req.params.teamid};`);
  return res.json(teamname);
});



// POST

// Generic CREATE

// TEAMS

app.get('/api/teams/all',async(req:any,res) => {
      const sql:string = 'select distinct id,name from teams order by id';
      const teams = await db.any(sql);
      return res.json(teams);
});


// USERS - CREATE

app.post('/api/users/createuser', async (req:TypedRequestBody<{user_name:string,email_address:string,firstname:string,surname:string}>,res)=>{
  try{
          const {user_name,email_address,firstname,surname} = req.body;
          const addUser = new ParameterizedQuery({
              text: 'INSERT INTO users(username,email_address,firstname,surname) values ($1,$2,$3,$4) returning Id;',
              values: [req.body.user_name,req.body.email_address,req.body.firstname,req.body.surname]});
          const id = await db.one(addUser);

          // add to team_members - no team
          const membership = {user_id:id,user_is_manager:false,team_id:-1};
          const addUsertoTeam = new ParameterizedQuery({
              text: 'INSERT INTO team_members(user_id,user_is_manager,team_id) values ($1,$2,$3,$4) returning Id;',
              values: [membership.user_id,membership.user_is_manager,membership.team_id]});
          await db.one(addUsertoTeam);

          return res.json({id});
  } catch(err){
      res.json(err);
          }
});

// JOB TITLE / TEAM - CREATE

app.post('/api/users/createnewteamjob',async (req:TypedRequestBody<{team_id:number,name:string}>,res)=>{
  try{
      const {team_id,name} = req.body;
      const add = new ParameterizedQuery({
          text:'insert into job_titles (team_id,name) values {$1,$2} returning id;',
          values:[team_id,name]});
      const id = await db.one(add);

  } catch(err){
      res.json(err).status(400);
  }
});

// JOB TITLE / DOCUMENT - CREATE


app.post('/api/users/adddocumenttojobtitle',async (req:TypedRequestBody<{document_id:number,job_title_id:number}>,res)=>{
  try{
      const {document_id,job_title_id} = req.body;
      const add = new ParameterizedQuery({
          text:'insert into job_documents (doc_id,job_id) values {$1,$2} returning id;',
          values:[document_id,job_title_id]});
      const id = await db.one(add);

  } catch(err){
      res.json(err).status(400);
  }
});

// TEAM - CREATE

app.post('/api/users/createteam',async (req:TypedRequestBody<{name:string}>,res)=>{
  try{
      const {name} = req.body;
      const add = new ParameterizedQuery({
          text:'INSERT INTO TEAMS (name) values ($1) returning Id;',
          values:[req.body.name]});
      const id = await db.one(add);

  } catch(err){
      res.json(err).status(400);
  }
});


// USER _ TEAM ADD USER TO TEAM

// this is an update call to team_members as it is already populated.
app.post('/app/users/addusertoteam',async(req:TypedRequestBody<{team_id:number,user_id:number}>,res)=>{
  const{team_id,user_id}= req.body;
  const update = new ParameterizedQuery({
      text:'UPDATE team_members set team_id = $1 where user_id = $2',
      values:[req.body.team_id,req.body.user_id]
  });
  await db.one(update);
});


app.post('/api/users/updateuserdocument',async (req:TypedRequestBody<{userid:string,documentid:string,newrevision:string}>,res) => {
  // fill in query here + add all required fields to the body, new rev number, documentid (not qt9 id)
  const success = await db.query(`update training_status set usercurrentrevision=${req.body.newrevision} ,trainingcomplete=true,training_complete_date = NOW() where userid = '${req.body.userid}' and documentid='${req.body.documentid}'`);
  return res.status(200);
});


app.post('/api/users/addusertomanager',async (req:TypedRequestBody<{managerid:number,userid:number}>,res:any)=>{
  try {
          const {userid,managerid} = req.body;
          const success = await db.one(`insert into orgchart(user_id,manager_id) values(${req.body.userid},${req.body.managerid}) returning id;`);
          return res.json(success);
  } catch(err){
      res.json(err).status(400);
  }
});


app.post('/api/users/deleteuserfrommanager',async (req:TypedRequestBody<{managerid:number,userid:number}>,res) => {
  const success = await db.query(`delete from orgchart where manager_id = ${req.body.managerid} and user_id = ${req.body.userid}`);
  return res.status(200);
});

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
