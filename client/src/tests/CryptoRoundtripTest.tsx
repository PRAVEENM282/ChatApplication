import { useEffect } from "react";
import React from "react";
import sodium from "libsodium-wrappers";
import { encryptMessage, decryptMessage } from "../services/crypto.service";

const CryptoRoundtripTest = () => {
  useEffect(() => {
    const runTest = async () => {
      await sodium.ready;

      const { publicKey: alicePub, privateKey: alicePriv } =
        sodium.crypto_box_keypair();
      const { publicKey: bobPub, privateKey: bobPriv } =
        sodium.crypto_box_keypair();

      

      const { ciphertextBase64, nonceBase64 } = await encryptMessage(
        "hello bob",
        sodium.to_base64(bobPub), // recipient pub key
        sodium.to_base64(alicePriv) // sender priv key
      );

      

      const decrypted = await decryptMessage(
        ciphertextBase64,
        nonceBase64,
        sodium.to_base64(alicePub), // sender pub key
        sodium.to_base64(bobPriv) // recipient priv key
      );

      
    };

    runTest();
  }, []);

  return <h1>Check the browser console for crypto roundtrip test 🔍</h1>;
};

export default CryptoRoundtripTest;