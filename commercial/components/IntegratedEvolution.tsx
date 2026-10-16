"use client";
import {useState} from 'react';
import StudentEvolution from './StudentEvolution';
import ClientTimeline from './ClientTimeline';
export default function IntegratedEvolution({org,clientId,userId}:{org:string;clientId:string;userId:string}){
 const [period,setPeriod]=useState(90);
 return <><StudentEvolution org={org} clientId={clientId} period={period} onPeriodChange={setPeriod}/><ClientTimeline org={org} clientId={clientId} userId={userId} period={period} onPeriodChange={setPeriod}/></>;
}
