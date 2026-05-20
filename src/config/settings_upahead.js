export const DEFAULT_UPAHEAD_SETTINGS = {
    categories: {
        movies: true,
        events: true,
        festivals: true,
        alerts: true,
        sports: true,
        shopping: true,
        civic: true,
        weather_alerts: true,
        airlines: true
    },
    ranking: {
        movies: { positiveMultiplier: 2.0, negativeMultiplier: 2.0, filterThreshold: 0 },
        events: { positiveMultiplier: 2.0, negativeMultiplier: 2.0, filterThreshold: 0 },
        festivals: { positiveMultiplier: 2.0, negativeMultiplier: 2.0, filterThreshold: 0 },
        sports: { positiveMultiplier: 2.0, negativeMultiplier: 2.0, filterThreshold: 0 },
        shopping: { positiveMultiplier: 2.0, negativeMultiplier: 2.0, filterThreshold: 0 },
        airlines: { positiveMultiplier: 2.0, negativeMultiplier: 2.0, filterThreshold: 0 },
        alerts: { positiveMultiplier: 2.0, negativeMultiplier: 2.0, filterThreshold: 0 },
        weather_alerts: { positiveMultiplier: 2.0, negativeMultiplier: 2.0, filterThreshold: 0 },
        civic: { positiveMultiplier: 2.0, negativeMultiplier: 2.0, filterThreshold: 0 }
    },
    weatherAlertRules: {
        ambiguousKeywords: ['watch', 'warning', 'alert', 'advisory'],
        contextKeywords: ['weather', 'rain', 'storm', 'cyclone', 'thunderstorm', 'wind', 'winds', 'flood', 'flooding', 'hail', 'lightning', 'heat wave', 'cold wave', 'fog', 'imd', 'met department', 'met office', 'high tide', 'storm surge'],
        bannerKeywords: ['weather', 'rain', 'storm', 'cyclone', 'thunderstorm', 'wind', 'winds', 'flood', 'flooding', 'hail', 'lightning', 'heat wave', 'cold wave', 'fog', 'imd', 'met department', 'met office', 'high tide', 'storm surge'],
        minimumMatches: 2,
        staleMaxAgeHours: 6
    },
    offerRules: {
        offerKeywords: ['sale', 'sales', 'discount', 'offer', 'offers', 'deal', 'deals', 'cashback', 'coupon', 'promo', 'promo code', 'booking open', 'book now', 'fare sale', 'ticket offer', 'limited period', 'last day', 'ends today'],
        minimumMatches: 1
    },
    deduplication: {
        similarityThreshold: 0.82,
        secondarySimilarityThreshold: 0.58,
        tokenOverlapThreshold: 0.5,
        strongTokenOverlapThreshold: 0.52,
        minimumSharedTokens: 3,
        strongSharedTokens: 4,
        maxFingerprintTokens: 8,
        ignoredTokens: ['a','an','and','are','at','be','between','by','for','from','how','in','into','is','it','of','on','or','the','this','that','to','was','were','with','who','why','will','alert','analysis','breaking','coverage','details','exclusive','explainer','headline','highlights','latest','live','news','photos','preview','prediction','predictions','report','reports','story','today','todays','update','updates','video','watch','expected','likely','lineup','lineups','match','playing','win','winner','winners','xis','xi']
    },
    locations: ['Chennai', 'Muscat'],
    customLocation: '',
    signals: ['upcoming','scheduled','starting','launches','opens','begins','commences','from today','this weekend','next week','releasing','premieres','debuts','kicks off','set to','slated for','expected on','effective from','valid till','last date','deadline','registrations open','bookings open','doors open','book now','tickets available','grab your','register','rsvp','sign up','enroll','apply before','limited seats','early bird','pre-order','advance booking','buy tickets','entry free','venue','stadium','auditorium','convention centre','exhibition hall','multiplex','arena','grounds','schedule','timetable','lineup','itinerary','match day','race day','show timings','showtimes','time slot','batch'],
    keywords: {
        movies: ['release date','releasing','release','in theatres','in theaters','first day','advance booking','fdfs','premiere','preview','sneak peek','special screening','ott release','streaming from','now streaming','available on','direct to ott','digital premiere','tickets','showtimes','book now','bookmyshow','ticketnew','paytm movies','trailer launch','teaser release','motion poster'],
        events: ['concert','live music','standup','comedy show','theatre','theater','drama','stage play','dance recital','sabha','kutcheri','kutchery','exhibition','expo','book fair','trade fair','flea market','art gallery','trade show','workshop','masterclass','bootcamp','seminar','webinar','hackathon','meetup','food festival','pop-up','tasting','brunch','food walk','heritage walk','night market','entry fee','passes available','gate open','limited slots','registration'],
        sports: [' vs ',' v/s ','match','fixture','squad announced','playing xi','toss','innings','schedule','points table','qualifier','semi final','final','playoffs','stadium','live on','broadcast','streaming','start time','kick off','first ball'],
        festivals: ['holiday','bank holiday','gazetted','declared holiday','government holiday','pongal','diwali','deepavali','navratri','dussehra','eid','ramadan','christmas','onam','vishu','ugadi','holi','ganesh','jayanti','puja','pooja','thai pusam','observed on','falls on','celebrated on','auspicious','muhurtham','tithi'],
        shopping: ['sale','mega sale','flash sale','clearance','end of season','flat discount','upto off','cashback','coupon','promo code','shopping festival','exhibition sale','trade fair','grand opening','limited period','ends today','last day','offer valid','while stocks last','hurry'],
        airlines: ['oman air','goindigo','salam air','ticket offer','flight deal','air india','vistara','akasa air','fare sale','booking open'],
        alerts: ['power cut','power shutdown','load shedding','tangedco','tneb','scheduled maintenance','water cut','water supply','disruption','traffic advisory','road closure','diversion','metro shutdown','bus route change','train cancelled','flight delayed','boil water advisory','mosquito fogging','tree trimming','construction zone'],
        weather_alerts: ['warning','alert','advisory','watch','red alert','orange alert','yellow alert','heavy rain','very heavy rain','cyclone','thunderstorm','heat wave','cold wave','fog','flooding','high tide','storm surge','imd','met department','weather bulletin'],
        civic: ['vip movement','vip visit','road block','security arrangement','route change','bandh','hartal','strike','protest march','rasta roko','rail roko','corporation notice','tender','public hearing','ward meeting','grievance day'],
        movies_negative: ['review','reviewed','reviews','opinion','editorial','column','interview','gossip','rumour','rumor','spotted','dating','controversy','trolled','slammed','reacts','reaction','leaked','wardrobe malfunction','breakup','case explained','box office collection','day 1 collection','total collection','worldwide gross','opening weekend','first week collection','crosses crore','nett collection','promo shoot','shooting begins','wrapped up','schedule wrap','title reveal','first look','motion poster','cast revealed','plot leaked','producer','director','music director','remuneration','salary','budget','rights sold','satellite rights','audio launch','pre-release event','success meet','press meet','renamed','casts','court','petition','arrested','stealing','sewage','overflow','warns against','talks','deal','financial results','board meeting','did for free','bank holiday alert','check full list','divorce','decommission','released crore','schedules board meeting','fog','mist'],
        events_negative: ['cancelled','postponed','webinar','virtual only','legacy','tribute','obituary'],
        sports_negative: ['rumour','speculation','opinion','prediction','predictions','bracketology','power rankings','fantasy value'],
        festivals_negative: [],
        shopping_negative: ['expired','sold out'],
        airlines_negative: ['accident','crash','emergency landing','technical snag'],
        alerts_negative: ['rumour','hoax','fake news'],
        civic_negative: ['clinic','surgery','transplant','arrested','held'],
        negative: ['review','reviewed','reviews','opinion','editorial','column','op-ed','analysis','deep dive','explainer','explained','interview','memoir','podcast','recap','retrospective','lookback','throwback','gossip','rumour','rumor','spotted','dating','divorce','controversy','trolled','slammed','reacts','reaction','claps back','feud','leaked','wardrobe malfunction','breakup','arrested','murder','stabbed','robbery','scam','fraud','accused','chargesheet','sentenced','bail','fir filed','kidnap','suicide','death toll','fatal','quarterly results','earnings call','dividend','stock split','ipo allotment','listing gains','shareholding pattern','promoter stake','mutual fund nav','portfolio rebalancing','alleges','slams','hits out','war of words','defamation','no confidence','horse trading','exit poll','poll prediction','meme','was held','concluded','wrapped up','came to an end','successfully completed','inaugurated by','flagged off','took place','was celebrated','passes away','passed away','demise','rip','condolences','last rites','funeral','pays tribute','mourns','obituary','top 10','top 5','best of','worst of','reasons why','things you','ranked','all you need to know','everything we know','box office collection','day 1 collection','total collection','worldwide gross','opening weekend','first week collection','crosses crore','nett collection','shocking','you won\'t believe','jaw dropping','gone viral','breaks the internet','exclusive','board meeting','financial results','quarterly results','dividend','earnings call','stock split','bonus issue','record date','schedules board meeting','to consider','fund raising','petrol price','price hike','title reveal','first look','renamed','locks release date','casts','producer','court','petition','arrested','stealing','sewage','warns','talks','deal','did for free','bank holiday alert','check full list','decommission','fog','mist','opens office','launches','inaugurated','reveals']
    }
};
