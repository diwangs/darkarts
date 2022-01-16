const fs = require('fs')
const path = require('path')
const circomlib = require('circomlib')
const { initialize } = require('zokrates-js/node');

const mimcSponge = input => circomlib.mimcsponge.multiHash(input, undefined, 1)

initialize().then((zokratesProvider) => {

    const pathPrefix = "./circuitszok/"
    const location = path.resolve(pathPrefix + "withdraw.zok")
    const source = fs.readFileSync(location, "utf-8");
    const fileSystemResolver = (from, to) => {
        const location = path.resolve(path.dirname(path.resolve(pathPrefix + from)), to + ".zok");
        const source = fs.readFileSync(location).toString();
        return { source, location };
    };
    const options = {
        location: "withdraw.zok", // location of the root module
        resolveCallback: fileSystemResolver
    }
    // compilation
    const artifacts = zokratesProvider.compile(source, options);
    // artifacts -> program binary, abi

    // run setup
    const keypair = zokratesProvider.setup(artifacts.program);
    // keypair -> pk, vk

    // export solidity verifier
    const verifier = zokratesProvider.exportSolidityVerifier(keypair.vk, "v1");
    // fs.writeFileSync("../contracts/ZokVerifier.sol", verifier)

    // ---

    // computation
    // const input = [
    //     '8564126560818703612087196108197963582661250112152965155229128327789929625344',
    //     '6738485625203117522954663390864908802140497655293539224050926320716542244340',
    //     [
    //         false, false, false, false, false, false, false, false, false, false, false, false,
    //         false, false, false, false, false, false, false, false
    //     ],
    //     [
    //         '21663839004416932945382355908790599225266501822907911457504978515578255421292',
    //         '16923532097304556005972200564242292693309333953544141029519619077135960040221',
    //         '7833458610320835472520144237082236871909694928684820466656733259024982655488',
    //         '14506027710748750947258687001455876266559341618222612722926156490737302846427',
    //         '4766583705360062980279572762279781527342845808161105063909171241304075622345',
    //         '16640205414190175414380077665118269450294358858897019640557533278896634808665',
    //         '13024477302430254842915163302704885770955784224100349847438808884122720088412',
    //         '11345696205391376769769683860277269518617256738724086786512014734609753488820',
    //         '17235543131546745471991808272245772046758360534180976603221801364506032471936',
    //         '155962837046691114236524362966874066300454611955781275944230309195800494087',
    //         '14030416097908897320437553787826300082392928432242046897689557706485311282736',
    //         '12626316503845421241020584259526236205728737442715389902276517188414400172517',
    //         '6729873933803351171051407921027021443029157982378522227479748669930764447503',
    //         '12963910739953248305308691828220784129233893953613908022664851984069510335421',
    //         '8697310796973811813791996651816817650608143394255750603240183429036696711432',
    //         '9001816533475173848300051969191408053495003693097546138634479732228054209462',
    //         '13882856022500117449912597249521445907860641470008251408376408693167665584212',
    //         '6167697920744083294431071781953545901493956884412099107903554924846764168938',
    //         '16572499860108808790864031418434474032816278079272694833180094335573354127261',
    //         '11544818037702067293688063426012553693851444915243122674915303779243865603077'
    //       ]
    // ]
    // const input = [
    //     "123456789"
    // ]
    // const { witness, output } = zokratesProvider.computeWitness(artifacts, input);
    // console.log(output)
    // console.log(mimcSponge(input))

    // generate proof
    // const proof = zokratesProvider.generateProof(artifacts.program, witness, keypair.pk);

    // verify proof (doesn't work with 1.0.24 ?)
    // console.log(zokratesProvider.verify(keypair.vk, proof))
})
