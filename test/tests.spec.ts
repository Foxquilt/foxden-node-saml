"use strict";
import { SAML } from "../src/saml";
import { URL } from "url";
import * as querystring from "querystring";
import { parseString, parseStringPromise } from "xml2js";
import * as fs from "fs";
import * as sinon from "sinon";
import { Profile, SamlConfig, ValidateInResponseTo, XMLOutput } from "../src/types";
import { RacComparision } from "../src/types.js";
import { expect } from "chai";
import * as assert from "assert";
import { FAKE_CERT, TEST_CERT } from "./types";
import { assertRequired, signXmlResponse } from "../src/utility";
import { parseDomFromString, validateSignature } from "../src/xml";

export const BAD_TEST_CERT =
  "MIIEOTCCAyGgAwIBAgIJAKZgJdKdCdL6MA0GCSqGSIb3DQEBBQUAMHAxCzAJBgNVBAYTAkFVMREwDwYDVQQIEwhWaWN0b3JpYTESMBAGA1UEBxMJTWVsYm91cm5lMSEwHwYDVQQKExhUYWJjb3JwIEhvbGRpbmdzIExpbWl0ZWQxFzAVBgNVBAMTDnN0cy50YWIuY29tLmF1MB4XDTE3MDUzMDA4NTQwOFoXDTI3MDUyODA4NTQwOFowcDELMAkGA1UEBhMCQVUxETAPBgNVBAgTCFZpY3RvcmlhMRIwEAYDVQQHEwlNZWxib3VybmUxITAfBgNVBAoTGFRhYmNvcnAgSG9sZGluZ3MgTGltaXRlZDEXMBUGA1UEAxMOc3RzLnRhYi5jb20uYXUwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQD0NuMcflq3rtupKYDf4a7lWmsXy66fYe9n8jB2DuLMakEJBlzn9j6B98IZftrilTq21VR7wUXROxG8BkN8IHY+l8X7lATmD28fFdZJj0c8Qk82eoq48faemth4fBMx2YrpnhU00jeXeP8dIIaJTPCHBTNgZltMMhphklN1YEPlzefJs3YD+Ryczy1JHbwETxt+BzO1JdjBe1fUTyl6KxAwWvtsNBURmQRYlDOk4GRgdkQnfxBuCpOMeOpV8wiBAi3h65Lab9C5avu4AJlA9e4qbOmWt6otQmgy5fiJVy6bH/d8uW7FJmSmePX9sqAWa9szhjdn36HHVQsfHC+IUEX7AgMBAAGjgdUwgdIwHQYDVR0OBBYEFN6z6cuxY7FTkg1S/lIjnS4x5ARWMIGiBgNVHSMEgZowgZeAFN6z6cuxY7FTkg1S/lIjnS4x5ARWoXSkcjBwMQswCQYDVQQGEwJBVTERMA8GA1UECBMIVmljdG9yaWExEjAQBgNVBAcTCU1lbGJvdXJuZTEhMB8GA1UEChMYVGFiY29ycCBIb2xkaW5ncyBMaW1pdGVkMRcwFQYDVQQDEw5zdHMudGFiLmNvbS5hdYIJAKZgJdKdCdL6MAwGA1UdEwQFMAMBAf8wDQYJKoZIhvcNAQEFBQADggEBAMi5HyvXgRa4+kKz3dk4SwAEXzeZRcsbeDJWVUxdb6a+JQxIoG7L9rSbd6yZvP/Xel5TrcwpCpl5eikzXB02/C0wZKWicNmDEBlOfw0Pc5ngdoh6ntxHIWm5QMlAfjR0dgTlojN4Msw2qk7cP1QEkV96e2BJUaqaNnM3zMvd7cfRjPNfbsbwl6hCCCAdwrALKYtBnjKVrCGPwO+xiw5mUJhZ1n6ZivTOdQEWbl26UO60J9ItiWP8VK0d0aChn326Ovt7qC4S3AgDlaJwcKe5Ifxl/UOWePGRwXj2UUuDWFhjtVmRntMmNZbe5yE8MkEvU+4/c6LqGwTCgDenRbK53Dgg";

export const noop = (): void => undefined;

describe("node-saml /", function () {
  describe("saml.js / ", function () {
    it("should throw an error if cert property is provided to saml constructor but is empty", function () {
      expect(function () {
        const strategy = new SAML({
          cert: undefined as unknown as string,
          issuer: "onelogin_saml",
        });
        typeof strategy.options.cert === "undefined";
      }).throw("cert is required");
    });

    it("_generateLogoutRequest", function (done) {
      try {
        const expectedRequest = {
          "samlp:LogoutRequest": {
            $: {
              "xmlns:samlp": "urn:oasis:names:tc:SAML:2.0:protocol",
              "xmlns:saml": "urn:oasis:names:tc:SAML:2.0:assertion",
              //ID: '_85ba0a112df1ffb57805',
              Version: "2.0",
              //IssueInstant: '2014-05-29T03:32:23Z',
              Destination: "foo",
            },
            "saml:Issuer": [
              { _: "onelogin_saml", $: { "xmlns:saml": "urn:oasis:names:tc:SAML:2.0:assertion" } },
            ],
            "saml:NameID": [{ _: "bar", $: { Format: "foo" } }],
          },
        };

        const samlObj = new SAML({ entryPoint: "foo", cert: FAKE_CERT, issuer: "onelogin_saml" });
        const logoutRequestPromise = samlObj._generateLogoutRequest({
          ID: "id",
          issuer: "issuer",
          nameIDFormat: "foo",
          nameID: "bar",
        });

        logoutRequestPromise
          .then(function (logoutRequest) {
            parseString(logoutRequest, function (err, doc) {
              try {
                delete doc["samlp:LogoutRequest"]["$"]["ID"];
                delete doc["samlp:LogoutRequest"]["$"]["IssueInstant"];
                expect(doc).to.deep.equal(expectedRequest);
                done();
              } catch (err2) {
                done(err2);
              }
            });
          })
          .catch((err: Error) => {
            done(err);
          });
      } catch (err3) {
        done(err3);
      }
    });

    it("_generateLogoutRequest adds the NameQualifier and SPNameQualifier to the saml request", function (done) {
      try {
        const expectedRequest = {
          "samlp:LogoutRequest": {
            $: {
              "xmlns:samlp": "urn:oasis:names:tc:SAML:2.0:protocol",
              "xmlns:saml": "urn:oasis:names:tc:SAML:2.0:assertion",
              //ID: '_85ba0a112df1ffb57805',
              Version: "2.0",
              //IssueInstant: '2014-05-29T03:32:23Z',
              Destination: "foo",
            },
            "saml:Issuer": [
              { _: "onelogin_saml", $: { "xmlns:saml": "urn:oasis:names:tc:SAML:2.0:assertion" } },
            ],
            "saml:NameID": [
              {
                _: "bar",
                $: {
                  Format: "foo",
                  SPNameQualifier: "Service Provider",
                  NameQualifier: "Identity Provider",
                },
              },
            ],
          },
        };

        const samlObj = new SAML({ entryPoint: "foo", cert: FAKE_CERT, issuer: "onelogin_saml" });
        const logoutRequestPromise = samlObj._generateLogoutRequest({
          ID: "id",
          issuer: "issuer",
          nameIDFormat: "foo",
          nameID: "bar",
          nameQualifier: "Identity Provider",
          spNameQualifier: "Service Provider",
        });

        logoutRequestPromise
          .then(function (logoutRequest) {
            parseString(logoutRequest, function (err, doc) {
              try {
                delete doc["samlp:LogoutRequest"]["$"]["ID"];
                delete doc["samlp:LogoutRequest"]["$"]["IssueInstant"];
                expect(doc).to.deep.equal(expectedRequest);
                done();
              } catch (err2) {
                done(err2);
              }
            });
          })
          .catch((err: Error) => {
            done(err);
          });
      } catch (err3) {
        done(err3);
      }
    });

    it("_generateLogoutRequest should throw error when samlLogoutRequestExtensions is not a object", async function () {
      const config: SamlConfig = {
        entryPoint: "https://wwwexampleIdp.com/saml",
        cert: FAKE_CERT,
        samlLogoutRequestExtensions: "anyvalue" as unknown as Record<string, unknown>,
        issuer: "onelogin_saml",
      };
      const samlObj = new SAML(config);
      const profile: Profile = {
        issuer: "https://test,com",
        nameIDFormat: "foo",
        nameID: "bar",
      };
      await assert.rejects(samlObj._generateLogoutRequest(profile), {
        message: "samlLogoutRequestExtensions should be Object",
      });
    });

    it("_generateLogoutRequest should return extensions element when samlLogoutRequestExtensions is configured", function (done) {
      try {
        const expectedRequest = {
          "samlp:LogoutRequest": {
            $: {
              "xmlns:samlp": "urn:oasis:names:tc:SAML:2.0:protocol",
              "xmlns:saml": "urn:oasis:names:tc:SAML:2.0:assertion",
              //ID: '_85ba0a112df1ffb57805',
              Version: "2.0",
              //IssueInstant: '2014-05-29T03:32:23Z',
              Destination: "foo",
            },
            "saml:Issuer": [
              { _: "onelogin_saml", $: { "xmlns:saml": "urn:oasis:names:tc:SAML:2.0:assertion" } },
            ],
            "samlp:Extensions": [
              {
                $: {
                  "xmlns:samlp": "urn:oasis:names:tc:SAML:2.0:protocol",
                },
                vetuma: [
                  {
                    $: { xmlns: "urn:vetuma:SAML:2.0:extensions" },
                    LG: ["sv"],
                  },
                ],
              },
            ],
            "saml:NameID": [{ _: "bar", $: { Format: "foo" } }],
          },
        };

        const samlObj = new SAML({
          entryPoint: "foo",
          cert: FAKE_CERT,
          samlLogoutRequestExtensions: {
            vetuma: {
              "@xmlns": "urn:vetuma:SAML:2.0:extensions",
              LG: {
                "#text": "sv",
              },
            },
          },
          issuer: "onelogin_saml",
        });
        const profile: Profile = {
          issuer: "https://test.com",
          nameIDFormat: "foo",
          nameID: "bar",
        };
        const logoutRequestPromise = samlObj._generateLogoutRequest(profile);

        logoutRequestPromise
          .then(function (logoutRequest) {
            parseStringPromise(logoutRequest)
              .then(function (doc) {
                delete doc["samlp:LogoutRequest"]["$"]["ID"];
                delete doc["samlp:LogoutRequest"]["$"]["IssueInstant"];
                expect(doc).to.deep.equal(expectedRequest);
                done();
              })
              .catch((err: Error) => {
                done(err);
              });
          })
          .catch((err: Error) => {
            done(err);
          });
      } catch (err3) {
        done(err3);
      }
    });

    it("_generateLogoutResponse success", function (done) {
      const expectedResponse = {
        "samlp:LogoutResponse": {
          $: {
            "xmlns:samlp": "urn:oasis:names:tc:SAML:2.0:protocol",
            "xmlns:saml": "urn:oasis:names:tc:SAML:2.0:assertion",
            //ID: '_d11b3c5e085b2417f4aa',
            Version: "2.0",
            //IssueInstant: '2014-05-29T01:11:32Z',
            Destination: "foo",
            InResponseTo: "quux",
          },
          "saml:Issuer": ["onelogin_saml"],
          "samlp:Status": [
            {
              "samlp:StatusCode": [{ $: { Value: "urn:oasis:names:tc:SAML:2.0:status:Success" } }],
            },
          ],
        },
      };

      const samlObj = new SAML({ entryPoint: "foo", cert: FAKE_CERT, issuer: "onelogin_saml" });
      const logoutRequest = samlObj._generateLogoutResponse(
        { ID: "quux", issuer: "issuer", nameID: "nameid", nameIDFormat: "nameidformat" },
        true
      );
      parseString(logoutRequest, function (err, doc) {
        try {
          delete doc["samlp:LogoutResponse"]["$"]["ID"];
          delete doc["samlp:LogoutResponse"]["$"]["IssueInstant"];
          expect(doc).to.deep.equal(expectedResponse);
          done();
        } catch (err2) {
          done(err2);
        }
      });
    });

    it("_generateLogoutResponse fail", function (done) {
      const expectedResponse = {
        "samlp:LogoutResponse": {
          $: {
            "xmlns:samlp": "urn:oasis:names:tc:SAML:2.0:protocol",
            "xmlns:saml": "urn:oasis:names:tc:SAML:2.0:assertion",
            //ID: '_d11b3c5e085b2417f4aa',
            Version: "2.0",
            //IssueInstant: '2014-05-29T01:11:32Z',
            Destination: "foo",
            InResponseTo: "quux",
          },
          "saml:Issuer": ["onelogin_saml"],
          "samlp:Status": [
            {
              "samlp:StatusCode": [
                {
                  $: { Value: "urn:oasis:names:tc:SAML:2.0:status:Requester" },
                  "samlp:StatusCode": [
                    { $: { Value: "urn:oasis:names:tc:SAML:2.0:status:UnknownPrincipal" } },
                  ],
                },
              ],
            },
          ],
        },
      };

      const samlObj = new SAML({ entryPoint: "foo", cert: FAKE_CERT, issuer: "onelogin_saml" });
      const logoutRequest = samlObj._generateLogoutResponse(
        { ID: "quux", issuer: "issuer", nameID: "nameid", nameIDFormat: "nameidformat" },
        false
      );
      parseString(logoutRequest, function (err, doc) {
        try {
          delete doc["samlp:LogoutResponse"]["$"]["ID"];
          delete doc["samlp:LogoutResponse"]["$"]["IssueInstant"];
          expect(doc).to.deep.equal(expectedResponse);
          done();
        } catch (err2) {
          done(err2);
        }
      });
    });

    it("_generateLogoutRequest with session index", function (done) {
      try {
        const expectedRequest = {
          "samlp:LogoutRequest": {
            $: {
              "xmlns:samlp": "urn:oasis:names:tc:SAML:2.0:protocol",
              "xmlns:saml": "urn:oasis:names:tc:SAML:2.0:assertion",
              //ID: '_85ba0a112df1ffb57805',
              Version: "2.0",
              //IssueInstant: '2014-05-29T03:32:23Z',
              Destination: "foo",
            },
            "saml:Issuer": [
              { _: "onelogin_saml", $: { "xmlns:saml": "urn:oasis:names:tc:SAML:2.0:assertion" } },
            ],
            "saml:NameID": [{ _: "bar", $: { Format: "foo" } }],
            "saml2p:SessionIndex": [
              { _: "session-id", $: { "xmlns:saml2p": "urn:oasis:names:tc:SAML:2.0:protocol" } },
            ],
          },
        };

        const samlObj = new SAML({ entryPoint: "foo", cert: FAKE_CERT, issuer: "onelogin_saml" });
        const logoutRequestPromise = samlObj._generateLogoutRequest({
          ID: "id",
          issuer: "issuer",
          nameIDFormat: "foo",
          nameID: "bar",
          sessionIndex: "session-id",
        });

        logoutRequestPromise
          .then(function (logoutRequest) {
            parseString(logoutRequest, function (err, doc) {
              try {
                delete doc["samlp:LogoutRequest"]["$"]["ID"];
                delete doc["samlp:LogoutRequest"]["$"]["IssueInstant"];
                expect(doc).to.deep.equal(expectedRequest);
                done();
              } catch (err2) {
                done(err2);
              }
            });
          })
          .catch((err: Error) => {
            done(err);
          });
      } catch (err3) {
        done(err3);
      }
    });

    it("_generateLogoutRequest saves id and instant to cache", function (done) {
      const samlObj = new SAML({ entryPoint: "foo", cert: FAKE_CERT, issuer: "onelogin_saml" });
      const cacheSaveSpy = sinon.spy(samlObj.cacheProvider, "saveAsync");
      const logoutRequestPromise = samlObj._generateLogoutRequest({
        ID: "id",
        issuer: "issuer",
        nameIDFormat: "foo",
        nameID: "bar",
        sessionIndex: "session-id",
      });

      logoutRequestPromise.then(function (logoutRequest) {
        parseString(logoutRequest, function (err, doc) {
          try {
            const id = doc["samlp:LogoutRequest"]["$"]["ID"];
            const issueInstant = doc["samlp:LogoutRequest"]["$"]["IssueInstant"];

            expect(id).to.be.a("string");
            expect(issueInstant).to.be.a("string");
            expect(cacheSaveSpy.called).to.be.true;
            expect(cacheSaveSpy.calledWith(id, issueInstant)).to.be.true;

            done();
          } catch (err2) {
            done(err2);
          }
        });
      });
    });

    describe("generateServiceProviderMetadata tests /", function () {
      function testMetadata(
        samlConfig: SamlConfig,
        expectedMetadata: string,
        signingCert?: string | string[]
      ) {
        const samlObj = new SAML(samlConfig);
        const decryptionCert = fs.readFileSync(
          __dirname + "/static/testshib encryption cert.pem",
          "utf-8"
        );
        const metadata = samlObj.generateServiceProviderMetadata(decryptionCert, signingCert);

        const preparedMetadata = expectedMetadata.split("\n");

        // splits are to get a nice diff if they don't match for some reason
        //expect(metadata.split("\n")).to.equal(preparedMetadata);
        expect(metadata.split("\n")).to.eql(preparedMetadata);
      }

      it("config with callbackUrl and decryptionPvk should pass", function () {
        const samlConfig: SamlConfig = {
          issuer: "http://example.serviceprovider.com",
          callbackUrl: "http://example.serviceprovider.com/saml/callback",
          identifierFormat: "urn:oasis:names:tc:SAML:2.0:nameid-format:transient",
          decryptionPvk: fs.readFileSync(__dirname + "/static/testshib encryption pvk.pem"),
          cert: FAKE_CERT,
          generateUniqueId: () => "d700077e-60ad-49c1-b93a-dd1753528708",
          wantAssertionsSigned: false,
        };
        const expectedMetadata = fs.readFileSync(
          __dirname + "/static/expected metadata.xml",
          "utf-8"
        );

        testMetadata(samlConfig, expectedMetadata);
      });

      it("config with callbackUrl should pass", function () {
        const samlConfig: SamlConfig = {
          issuer: "http://example.serviceprovider.com",
          callbackUrl: "http://example.serviceprovider.com/saml/callback",
          identifierFormat: "urn:oasis:names:tc:SAML:2.0:nameid-format:transient",
          cert: FAKE_CERT,
          generateUniqueId: () => "d700077e-60ad-49c1-b93a-dd1753528708",
          wantAssertionsSigned: false,
        };
        const expectedMetadata = fs.readFileSync(
          __dirname + "/static/expected metadata without key.xml",
          "utf-8"
        );

        testMetadata(samlConfig, expectedMetadata);
      });

      it("config with protocol, path, host, and decryptionPvk should pass", function () {
        const samlConfig: SamlConfig = {
          issuer: "http://example.serviceprovider.com",
          protocol: "http://",
          host: "example.serviceprovider.com",
          path: "/saml/callback",
          identifierFormat: "urn:oasis:names:tc:SAML:2.0:nameid-format:transient",
          decryptionPvk: fs.readFileSync(__dirname + "/static/testshib encryption pvk.pem"),
          cert: FAKE_CERT,
          generateUniqueId: () => "d700077e-60ad-49c1-b93a-dd1753528708",
          wantAssertionsSigned: false,
        };
        const expectedMetadata = fs.readFileSync(
          __dirname + "/static/expected metadata.xml",
          "utf-8"
        );

        testMetadata(samlConfig, expectedMetadata);
      });

      it("config with protocol, path, and host should pass", function () {
        const samlConfig: SamlConfig = {
          issuer: "http://example.serviceprovider.com",
          protocol: "http://",
          host: "example.serviceprovider.com",
          path: "/saml/callback",
          identifierFormat: "urn:oasis:names:tc:SAML:2.0:nameid-format:transient",
          cert: FAKE_CERT,
          generateUniqueId: () => "d700077e-60ad-49c1-b93a-dd1753528708",
          wantAssertionsSigned: false,
        };
        const expectedMetadata = fs.readFileSync(
          __dirname + "/static/expected metadata without key.xml",
          "utf-8"
        );

        testMetadata(samlConfig, expectedMetadata);
      });

      it("config with protocol, path, host, decryptionPvk and privateKey should pass", function () {
        const samlConfig: SamlConfig = {
          issuer: "http://example.serviceprovider.com",
          protocol: "http://",
          host: "example.serviceprovider.com",
          path: "/saml/callback",
          identifierFormat: "urn:oasis:names:tc:SAML:2.0:nameid-format:transient",
          decryptionPvk: fs.readFileSync(__dirname + "/static/testshib encryption pvk.pem"),
          privateKey: fs.readFileSync(__dirname + "/static/acme_tools_com.key"),
          cert: FAKE_CERT,
          generateUniqueId: () => "d700077e-60ad-49c1-b93a-dd1753528708",
          wantAssertionsSigned: false,
        };
        const expectedMetadata = fs.readFileSync(
          __dirname + "/static/expectedMetadataWithBothKeys.xml",
          "utf-8"
        );
        const signingCert = fs.readFileSync(__dirname + "/static/acme_tools_com.cert").toString();

        testMetadata(samlConfig, expectedMetadata, signingCert);
      });

      it("config with encryption and two signing certificates should pass", function () {
        const samlConfig: SamlConfig = {
          issuer: "http://example.serviceprovider.com",
          protocol: "http://",
          host: "example.serviceprovider.com",
          path: "/saml/callback",
          identifierFormat: "urn:oasis:names:tc:SAML:2.0:nameid-format:transient",
          decryptionPvk: fs.readFileSync(__dirname + "/static/testshib encryption pvk.pem"),
          privateKey: fs.readFileSync(__dirname + "/static/acme_tools_com.key"),
          cert: FAKE_CERT,
          generateUniqueId: () => "d700077e-60ad-49c1-b93a-dd1753528708",
          wantAssertionsSigned: false,
        };
        const expectedMetadata = fs.readFileSync(
          __dirname + "/static/expectedMetadataWithEncryptionAndTwoSigningKeys.xml",
          "utf-8"
        );
        const signingCerts = [
          fs.readFileSync(__dirname + "/static/acme_tools_com.cert").toString(),
          fs.readFileSync(__dirname + "/static/cert.pem").toString(),
        ];

        testMetadata(samlConfig, expectedMetadata, signingCerts);
      });

      it("generateServiceProviderMetadata contains logout callback url", function () {
        const samlConfig: SamlConfig = {
          issuer: "http://example.serviceprovider.com",
          callbackUrl: "http://example.serviceprovider.com/saml/callback",
          identifierFormat: "urn:oasis:names:tc:SAML:2.0:nameid-format:transient",
          decryptionPvk: fs.readFileSync(__dirname + "/static/testshib encryption pvk.pem"),
          logoutCallbackUrl: "http://example.serviceprovider.com/logout",
          cert: FAKE_CERT,
        };

        const samlObj = new SAML(samlConfig);
        const decryptionCert = fs.readFileSync(
          __dirname + "/static/testshib encryption cert.pem",
          "utf-8"
        );
        const metadata = samlObj.generateServiceProviderMetadata(decryptionCert);
        expect(metadata).to.contain("SingleLogoutService");
        expect(metadata).to.contain(samlConfig.logoutCallbackUrl);
      });

      it("generateServiceProviderMetadata contains WantAssertionsSigned", function () {
        const samlConfig: SamlConfig = {
          cert: TEST_CERT,
          issuer: "http://example.serviceprovider.com",
          callbackUrl: "http://example.serviceprovider.com/saml/callback",
          identifierFormat: "urn:oasis:names:tc:SAML:2.0:nameid-format:transient",
          decryptionPvk: fs.readFileSync(__dirname + "/static/testshib encryption pvk.pem"),
        };

        const samlObj = new SAML(samlConfig);
        const decryptionCert = fs.readFileSync(
          __dirname + "/static/testshib encryption cert.pem",
          "utf-8"
        );
        const metadata = samlObj.generateServiceProviderMetadata(decryptionCert);
        expect(metadata).to.contain('WantAssertionsSigned="true"');
      });

      it("generateServiceProviderMetadata throw error", function () {
        const samlConfig: SamlConfig = {
          cert: TEST_CERT,
          issuer: "http://example.serviceprovider.com",
          callbackUrl: "http://example.serviceprovider.com/saml/callback",
          identifierFormat: "urn:oasis:names:tc:SAML:2.0:nameid-format:transient",
          decryptionPvk: fs.readFileSync(__dirname + "/static/testshib encryption pvk.pem"),
        };

        const samlObj = new SAML(samlConfig);
        let metadata;
        try {
          metadata = samlObj.generateServiceProviderMetadata(null);
        } catch (error) {
          // typescript
          if (error instanceof Error) {
            expect(error.toString()).to.contain(
              "Error: Missing decryptionCert while generating metadata for decrypting service provider"
            );
          }
        }
        expect(metadata).to.be.undefined;
      });

      it("generateServiceProviderMetadata contains AuthnRequestsSigned", function () {
        const samlConfig: SamlConfig = {
          cert: TEST_CERT,
          issuer: "http://example.serviceprovider.com",
          callbackUrl: "http://example.serviceprovider.com/saml/callback",
          identifierFormat: "urn:oasis:names:tc:SAML:2.0:nameid-format:transient",
          privateKey: fs.readFileSync(__dirname + "/static/acme_tools_com.key"),
        };

        const samlObj = new SAML(samlConfig);
        const signingCert = fs.readFileSync(__dirname + "/static/acme_tools_com.cert").toString();

        const metadata = samlObj.generateServiceProviderMetadata(null, signingCert);
        expect(metadata).to.contain('AuthnRequestsSigned="true"');
      });

      it("signMetadata creates a valid signature", async function () {
        const samlConfig: SamlConfig = {
          cert: TEST_CERT,
          issuer: "http://example.serviceprovider.com",
          callbackUrl: "http://example.serviceprovider.com/saml/callback",
          identifierFormat: "urn:oasis:names:tc:SAML:2.0:nameid-format:transient",
          privateKey: fs.readFileSync(__dirname + "/static/acme_tools_com.key"),
          signMetadata: true,
          signatureAlgorithm: "sha256",
          digestAlgorithm: "sha256",
        };

        const samlObj = new SAML(samlConfig);
        const signingCert = fs.readFileSync(__dirname + "/static/acme_tools_com.cert").toString();

        const metadata = samlObj.generateServiceProviderMetadata(null, signingCert);

        const dom = await parseDomFromString(metadata);
        expect(validateSignature(metadata, dom.documentElement, [signingCert])).to.be.true;
      });

      it("generateServiceProviderMetadata contains metadataExtensions", function () {
        const samlConfig: SamlConfig = {
          issuer: "http://example.serviceprovider.com",
          callbackUrl: "http://example.serviceprovider.com/saml/callback",
          identifierFormat: "urn:oasis:names:tc:SAML:2.0:nameid-format:transient",
          decryptionPvk: fs.readFileSync(__dirname + "/static/testshib encryption pvk.pem"),
          cert: FAKE_CERT,
          metadataContactPerson: [
            {
              "@contactType": "support",
              GivenName: "test",
              EmailAddress: ["test@node-saml"],
            },
          ],
          metadataOrganization: {
            OrganizationName: [
              {
                "@xml:lang": "en",
                "#text": "node-saml",
              },
            ],
            OrganizationDisplayName: [
              {
                "@xml:lang": "en",
                "#text": "node-saml",
              },
            ],
            OrganizationURL: [
              {
                "@xml:lang": "en",
                "#text": "https://github.com/node-saml",
              },
            ],
          },
          generateUniqueId: () => "d700077e-60ad-49c1-b93a-dd1753528708",
          wantAssertionsSigned: false,
        };

        const expectedMetadata = fs.readFileSync(
          __dirname + "/static/expected_metadata_metadataExtensions.xml",
          "utf-8"
        );

        testMetadata(samlConfig, expectedMetadata);
      });
    });

    describe("validatePostResponse checks /", function () {
      let fakeClock: sinon.SinonFakeTimers;

      afterEach(() => {
        if (fakeClock) {
          fakeClock.restore();
        }
      });

      it("response with junk content should explain the XML or base64 is not valid", async () => {
        const samlObj = new SAML({ cert: TEST_CERT, issuer: "onesaml_login" });
        await assert.rejects(samlObj.validatePostResponseAsync({ SAMLResponse: "BOOM" }), {
          message: "Not a valid XML document",
        });
      });
      it("response with error status message should generate appropriate error", async () => {
        const xml =
          '<?xml version="1.0" encoding="UTF-8"?><saml2p:Response xmlns:saml2p="urn:oasis:names:tc:SAML:2.0:protocol" Destination="http://localhost/browserSamlLogin" ID="_6a377272c8662561acf1056274ef3f81" InResponseTo="_4324fb0d00661146f7dc" IssueInstant="2014-07-02T18:16:31.278Z" Version="2.0"><saml2:Issuer xmlns:saml2="urn:oasis:names:tc:SAML:2.0:assertion" Format="urn:oasis:names:tc:SAML:2.0:nameid-format:entity">https://idp.testshib.org/idp/shibboleth</saml2:Issuer><saml2p:Status><saml2p:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Responder"><saml2p:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:InvalidNameIDPolicy"/></saml2p:StatusCode><saml2p:StatusMessage>Required NameID format not supported</saml2p:StatusMessage></saml2p:Status></saml2p:Response>';
        const base64xml = Buffer.from(xml).toString("base64");
        const container = { SAMLResponse: base64xml };
        const samlObj = new SAML({
          cert: "-----BEGIN CERTIFICATE-----" + TEST_CERT + "-----END CERTIFICATE-----",
          issuer: "onesaml_login",
          wantAuthnResponseSigned: false,
        });
        await assert.rejects(samlObj.validatePostResponseAsync(container), {
          message: /Responder.*Required NameID format not supported/,
        });
      });

      it("response with error status code should generate appropriate error", async () => {
        const xml =
          '<?xml version="1.0" encoding="UTF-8"?><saml2p:Response xmlns:saml2p="urn:oasis:names:tc:SAML:2.0:protocol" Destination="http://localhost/browserSamlLogin" ID="_6a377272c8662561acf1056274ef3f81" InResponseTo="_4324fb0d00661146f7dc" IssueInstant="2014-07-02T18:16:31.278Z" Version="2.0"><saml2:Issuer xmlns:saml2="urn:oasis:names:tc:SAML:2.0:assertion" Format="urn:oasis:names:tc:SAML:2.0:nameid-format:entity">https://idp.testshib.org/idp/shibboleth</saml2:Issuer><saml2p:Status><saml2p:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Responder"><saml2p:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:InvalidNameIDPolicy"/></saml2p:StatusCode></saml2p:Status></saml2p:Response>';
        const base64xml = Buffer.from(xml).toString("base64");
        const container = { SAMLResponse: base64xml };
        const samlObj = new SAML({
          cert: FAKE_CERT,
          issuer: "onesaml_login",
          wantAuthnResponseSigned: false,
        });
        await assert.rejects(samlObj.validatePostResponseAsync(container), {
          message: /Responder.*InvalidNameIDPolicy/,
        });
      });

      it("response with NoPassive status code should generate appropriate error", async () => {
        const xml =
          '<?xml version="1.0" encoding="UTF-8"?><saml2p:Response xmlns:saml2p="urn:oasis:names:tc:SAML:2.0:protocol" Destination="http://localhost/browserSamlLogin" ID="_6a377272c8662561acf1056274ef3f81" InResponseTo="_4324fb0d00661146f7dc" IssueInstant="2014-07-02T18:16:31.278Z" Version="2.0"><saml2:Issuer xmlns:saml2="urn:oasis:names:tc:SAML:2.0:assertion" Format="urn:oasis:names:tc:SAML:2.0:nameid-format:entity">https://idp.testshib.org/idp/shibboleth</saml2:Issuer><saml2p:Status><saml2p:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Responder"><saml2p:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:NoPassive"/></saml2p:StatusCode></saml2p:Status></saml2p:Response>';
        const base64xml = Buffer.from(xml).toString("base64");
        const container = { SAMLResponse: base64xml };
        const samlObj = new SAML({
          cert: FAKE_CERT,
          issuer: "onesaml_login",
          wantAuthnResponseSigned: false,
        });
        await assert.rejects(samlObj.validatePostResponseAsync(container), {
          message: "Invalid signature: NoPassive",
        });
      });

      it("response with NoPassive status code should respond with empty set", async () => {
        const xml = `<?xml version="1.0"?>
<saml2p:Response xmlns:saml2p="urn:oasis:names:tc:SAML:2.0:protocol" Destination="http://localhost/browserSamlLogin" ID="pfxe0fff4b9-4920-b11d-fa40-0a1fd6e3f7c0" InResponseTo="_4324fb0d00661146f7dc" IssueInstant="2014-07-02T18:16:31.278Z" Version="2.0"><saml2:Issuer xmlns:saml2="urn:oasis:names:tc:SAML:2.0:assertion" Format="urn:oasis:names:tc:SAML:2.0:nameid-format:entity">https://idp.testshib.org/idp/shibboleth</saml2:Issuer><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
  <ds:SignedInfo><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
    <ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>
  <ds:Reference URI="#pfxe0fff4b9-4920-b11d-fa40-0a1fd6e3f7c0"><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><ds:DigestValue>NRAARUf82PgKvlY6SDTvIjk287I=</ds:DigestValue></ds:Reference></ds:SignedInfo><ds:SignatureValue>gGDjs2hFJPDwhvyARgyNNgfUJz3LvhrzACnaIKIuS4bA0hvu/9j631UPCLTgTE9Jy2CnSWZX4BiJFjppg+N1rEEO1anDn8Og/FICsMjB2nbLcZF9cjvDsAGlQQX+b5zL2QZvpGbswV1ijuR+Gd8wKitLBiJLYHomfaaj8V5rjbutrRj/yK9ZOWAT5baadyAAm6JA2HkuPEJMU+VPXt6zzhjAxf0xRzsXabqPfuwcZtru2eqrJRZg85XNMx9VMdMT05LWZn2Qx6JRYXI0vlwar5zbM6LroLpijoljsLk4m7cgkQI4himIv639nbktCzXaXgr+0fUohKLNscHuApsGWQ==</ds:SignatureValue>
<ds:KeyInfo><ds:X509Data><ds:X509Certificate>MIIDtTCCAp2gAwIBAgIJAKg4VeVcIDz1MA0GCSqGSIb3DQEBBQUAMEUxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpTb21lLVN0YXRlMSEwHwYDVQQKExhJbnRlcm5ldCBXaWRnaXRzIFB0eSBMdGQwHhcNMTUwODEzMDE1NDIwWhcNMTUwOTEyMDE1NDIwWjBFMQswCQYDVQQGEwJVUzETMBEGA1UECBMKU29tZS1TdGF0ZTEhMB8GA1UEChMYSW50ZXJuZXQgV2lkZ2l0cyBQdHkgTHRkMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxG3ouM7U+fXbJt69X1H6d4UNg/uRr06pFuU9RkfIwNC+yaXyptqB3ynXKsL7BFt4DCd0fflRvJAx3feJIDp16wN9GDVHcufWMYPhh2j5HcTW/j9JoIJzGhJyvO00YKBt+hHy83iN1SdChKv5y0iSyiPP5GnqFw+ayyHoM6hSO0PqBou1Xb0ZSIE+DHosBnvVna5w2AiPY4xrJl9yZHZ4Q7DfMiYTgstjETio4bX+6oLiBnYktn7DjdEslqhffVme4PuBxNojI+uCeg/sn4QVLd/iogMJfDWNuLD8326Mi/FE9cCRvFlvAiMSaebMI3zPaySsxTK7Zgj5TpEbmbHI9wIDAQABo4GnMIGkMB0GA1UdDgQWBBSVGgvoW4MhMuzBGce29PY8vSzHFzB1BgNVHSMEbjBsgBSVGgvoW4MhMuzBGce29PY8vSzHF6FJpEcwRTELMAkGA1UEBhMCVVMxEzARBgNVBAgTClNvbWUtU3RhdGUxITAfBgNVBAoTGEludGVybmV0IFdpZGdpdHMgUHR5IEx0ZIIJAKg4VeVcIDz1MAwGA1UdEwQFMAMBAf8wDQYJKoZIhvcNAQEFBQADggEBAJu1rqs+anD74dbdwgd3CnqnQsQDJiEXmBhG2leaGt3ve9b/9gKaJg2pyb2NyppDe1uLqh6nNXDuzg1oNZrPz5pJL/eCXPl7FhxhMUi04TtLf8LeNTCIWYZiFuO4pmhohHcv8kRvYR1+6SkLTC8j/TZerm7qvesSiTQFNapa1eNdVQ8nFwVkEtWl+JzKEM1BlRcn42sjJkijeFp7DpI7pU+PnYeiaXpRv5pJo8ogM1iFxN+SnfEs0EuQ7fhKIG9aHKi7bKZ7L6SyX7MDIGLeulEU6lf5D9BfXNmcMambiS0pXhL2QXajt96UBq8FT2KNXY8XNtR4y6MyyCzhaiZZcc8=</ds:X509Certificate></ds:X509Data></ds:KeyInfo></ds:Signature><saml2p:Status><saml2p:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Responder"><saml2p:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:NoPassive"/></saml2p:StatusCode></saml2p:Status></saml2p:Response>`;
        const base64xml = Buffer.from(xml).toString("base64");
        const container = { SAMLResponse: base64xml };
        const signingCert = fs.readFileSync(__dirname + "/static/cert.pem", "utf-8");
        const samlObj = new SAML({
          cert: signingCert,
          issuer: "onesaml_login",
          wantAssertionsSigned: false,
          wantAuthnResponseSigned: false,
        });
        const response = await samlObj.validatePostResponseAsync(container);
        expect(response).to.deep.equal({ profile: null, loggedOut: false });
      });

      it("accept response with an attributeStatement element without attributeValue", async () => {
        fakeClock = sinon.useFakeTimers(Date.parse("2015-08-31T08:55:00+00:00"));

        const container = {
          SAMLResponse: fs
            .readFileSync(__dirname + "/static/response-with-uncomplete-attribute.xml")
            .toString("base64"),
        };

        const signingCert = fs.readFileSync(__dirname + "/static/cert.pem", "utf-8");

        const samlObj = new SAML({
          cert: signingCert,
          audience: false,
          issuer: "onesaml_login",
          wantAssertionsSigned: false,
        });
        const { profile } = await samlObj.validatePostResponseAsync(container);
        assertRequired(profile, "profile must exist");
        expect(profile.issuer).to.equal("https://evil-corp.com");
        expect(profile.nameID).to.equal("vincent.vega@evil-corp.com");
        expect(profile).to.have.property("evil-corp.egroupid", "vincent.vega@evil-corp.com");
        // attributes without attributeValue child should be ignored
        expect(profile).to.not.have.property("evilcorp.roles");
      });

      it("valid xml document with multiple SubjectConfirmation should validate", async () => {
        fakeClock = sinon.useFakeTimers(Date.parse("2020-09-24T16:00:00+00:00"));
        const base64xml = fs.readFileSync(
          __dirname + "/static/response.root-signed.message-signed-double-subjectconfirmation.xml",
          "base64"
        );
        const container = { SAMLResponse: base64xml };
        const signingCert = fs.readFileSync(__dirname + "/static/cert.pem", "utf-8");
        const privateKey = fs.readFileSync(__dirname + "/static/key.pem", "utf-8");

        const samlObj = new SAML({
          cert: signingCert,
          privateKey: privateKey,
          issuer: "onesaml_login",
          audience: false,
          validateInResponseTo: ValidateInResponseTo.always,
          wantAssertionsSigned: false,
        });

        // Prime cache so we can validate InResponseTo
        await samlObj.cacheProvider.saveAsync("_e8df3fe5f04237d25670", new Date().toISOString());
        // The second `SubjectConfirmationData` is invalid, so if this passes, we are using the first one
        const { profile } = await samlObj.validatePostResponseAsync(container);
        assertRequired(profile, "profile must exist");
        expect(profile.nameID).to.equal("vincent.vega@evil-corp.com");
      });

      it("valid xml document with multiple SubjectConfirmation should fail if no one is valid", async () => {
        fakeClock = sinon.useFakeTimers(Date.parse("2020-09-25T19:00:00+00:00"));
        const base64xml = fs.readFileSync(
          __dirname + "/static/response.root-signed.message-signed-double-subjectconfirmation.xml",
          "base64"
        );
        const container = { SAMLResponse: base64xml };
        const signingCert = fs.readFileSync(__dirname + "/static/cert.pem", "utf-8");
        const privateKey = fs.readFileSync(__dirname + "/static/key.pem", "utf-8");

        const samlObj = new SAML({
          cert: signingCert,
          privateKey: privateKey,
          issuer: "onesaml_login",
          audience: false,
          validateInResponseTo: ValidateInResponseTo.always,
          wantAssertionsSigned: false,
        });

        // Prime cache so we can validate InResponseTo
        await samlObj.cacheProvider.saveAsync("_e8df3fe5f04237d25670", new Date().toISOString());
        // The second `SubjectConfirmationData` is invalid, the first one could not be used so we should get
        await assert.rejects(samlObj.validatePostResponseAsync(container), {
          message:
            "No valid subject confirmation found among those available in the SAML assertion",
        });
      });

      it("valid xml document with multiple SubjectConfirmation should validate, first is expired so it should take the second one", async () => {
        fakeClock = sinon.useFakeTimers(Date.parse("2020-09-25T16:00:00+00:00"));
        const base64xml = fs.readFileSync(
          __dirname + "/static/response.root-signed.message-signed-double-subjectconfirmation.xml",
          "base64"
        );
        const container = { SAMLResponse: base64xml };
        const signingCert = fs.readFileSync(__dirname + "/static/cert.pem", "utf-8");
        const privateKey = fs.readFileSync(__dirname + "/static/key.pem", "utf-8");

        const samlObj = new SAML({
          cert: signingCert,
          privateKey: privateKey,
          issuer: "onesaml_login",
          audience: false,
          validateInResponseTo: ValidateInResponseTo.always,
          wantAssertionsSigned: false,
        });

        // Prime cache so we can validate InResponseTo
        await samlObj.cacheProvider.saveAsync("_e8df3fe5f04237d25670", new Date().toISOString());
        // The second `SubjectConfirmationData` purposefully has the wrong InResponseTo so we can check for it
        await assert.rejects(samlObj.validatePostResponseAsync(container), {
          message: "InResponseTo does not match subjectInResponseTo",
        });
      });

      it("valid xml document with multiple SubjectConfirmations should fail if InResponseTo does not match a valid SubjectConfirmation", async () => {
        fakeClock = sinon.useFakeTimers(Date.parse("2020-09-25T16:00:00+00:00"));
        const base64xml = fs.readFileSync(
          __dirname + "/static/response.root-signed.message-signed-double-subjectconfirmation.xml",
          "base64"
        );
        const container = { SAMLResponse: base64xml };
        const signingCert = fs.readFileSync(__dirname + "/static/cert.pem", "utf-8");
        const privateKey = fs.readFileSync(__dirname + "/static/key.pem", "utf-8");

        const samlObj = new SAML({
          cert: signingCert,
          privateKey: privateKey,
          issuer: "onesaml_login",
          audience: false,
          validateInResponseTo: ValidateInResponseTo.always,
          wantAssertionsSigned: false,
        });

        // Prime cache so we can validate InResponseTo
        await samlObj.cacheProvider.saveAsync("_e8df3fe5f04237d25670", new Date().toISOString());
        // The second `SubjectConfirmationData` purposefully has the wrong InResponseTo so we can check for it
        await assert.rejects(samlObj.validatePostResponseAsync(container), {
          message: "InResponseTo does not match subjectInResponseTo",
        });
      });

      it("valid xml document with no SubjectConfirmation should validate", async () => {
        fakeClock = sinon.useFakeTimers(Date.parse("2020-09-25T16:00:00+00:00"));
        const base64xml = fs.readFileSync(
          __dirname + "/static/response.root-signed.message-signed-no-subjectconfirmation.xml",
          "base64"
        );
        const container = { SAMLResponse: base64xml };
        const signingCert = fs.readFileSync(__dirname + "/static/cert.pem", "utf-8");
        const privateKey = fs.readFileSync(__dirname + "/static/key.pem", "utf-8");

        const samlObj = new SAML({
          cert: signingCert,
          privateKey: privateKey,
          issuer: "onesaml_login",
          audience: false,
          validateInResponseTo: ValidateInResponseTo.always,
          wantAssertionsSigned: false,
        });

        // Prime cache so we can validate InResponseTo
        await samlObj.cacheProvider.saveAsync("_e8df3fe5f04237d25670", new Date().toISOString());
        const { profile } = await samlObj.validatePostResponseAsync(container);
        assertRequired(profile, "profile must exist");
      });

      it("valid xml document with only empty SubjectConfirmation should not validate", async () => {
        fakeClock = sinon.useFakeTimers(Date.parse("2020-09-25T16:00:00+00:00"));
        const base64xml = fs.readFileSync(
          __dirname + "/static/response.root-signed.message-signed-empty-subjectconfirmation.xml",
          "base64"
        );
        const container = { SAMLResponse: base64xml };
        const signingCert = fs.readFileSync(__dirname + "/static/cert.pem", "utf-8");
        const privateKey = fs.readFileSync(__dirname + "/static/key.pem", "utf-8");

        const samlObj = new SAML({
          cert: signingCert,
          privateKey: privateKey,
          issuer: "onesaml_login",
          audience: false,
          validateInResponseTo: ValidateInResponseTo.always,
          wantAssertionsSigned: false,
        });

        // Prime cache so we can validate InResponseTo
        await samlObj.cacheProvider.saveAsync("_e8df3fe5f04237d25670", new Date().toISOString());
        await assert.rejects(samlObj.validatePostResponseAsync(container), {
          message:
            "No valid subject confirmation found among those available in the SAML assertion",
        });
      });

      // [ValidateInResponseTo.always, ValidateInResponseTo.ifPresent].forEach(
      //   (validateInResponseTo) => {
      //     describe(`with validateInResponseTo set to ${validateInResponseTo}`, () => {
      //       it(`removes InResponseTo value if response validation fails when validateInResponseTo=${validateInResponseTo}`, async () => {
      //         const requestId = "_a6fc46be84e1e3cf3c50";
      //         const xml =
      //           '<samlp:Response xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="R689b0733bccca22a137e3654830312332940b1be" Version="2.0" IssueInstant="2014-05-28T00:16:08Z" Destination="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>' +
      //           '<saml:Assertion xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="2.0" ID="pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa" IssueInstant="2014-05-28T00:16:08Z"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/><ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><ds:Reference URI="#pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa"><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><ds:DigestValue>DCnPTQYBb1hKspbe6fg1U3q8xn4=</ds:DigestValue></ds:Reference></ds:SignedInfo><ds:SignatureValue>e0+aFomA0+JAY0f9tKqzIuqIVSSw7LiFUsneEDKPBWdiTz1sMdgr/2y1e9+rjaS2mRmCi/vSQLY3zTYz0hp6nJNU19+TWoXo9kHQyWT4KkeQL4Xs/gZ/AoKC20iHVKtpPps0IQ0Ml/qRoouSitt6Sf/WDz2LV/pWcH2hx5tv3xSw36hK2NQc7qw7r1mEXnvcjXReYo8rrVf7XHGGxNoRIEICUIi110uvsWemSXf0Z0dyb0FVYOWuSsQMDlzNpheADBifFO4UTfSEhFZvn8kVCGZUIwrbOhZ2d/+YEtgyuTg+qtslgfy4dwd4TvEcfuRzQTazeefprSFyiQckAXOjcw==</ds:SignatureValue><ds:KeyInfo><ds:X509Data><ds:X509Certificate>' +
      //           TEST_CERT +
      //           '</ds:X509Certificate></ds:X509Data></ds:KeyInfo></ds:Signature><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">ben@subspacesw.com</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData NotOnOrAfter="2014-05-28T00:19:08Z" Recipient="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"/></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="2014-05-28T00:13:08Z" NotOnOrAfter="2014-05-28T00:19:08Z"><saml:AudienceRestriction><saml:Audience>{audience}</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AuthnStatement AuthnInstant="2014-05-28T00:16:07Z" SessionNotOnOrAfter="2014-05-29T00:16:08Z" SessionIndex="_30a4af50-c82b-0131-f8b5-782bcb56fcaa"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement></saml:Assertion>' +
      //           "</samlp:Response>";
      //         const base64xml = Buffer.from(xml).toString("base64");
      //         const container = { SAMLResponse: base64xml };
      //         const samlConfig: SamlConfig = {
      //           entryPoint: "https://app.onelogin.com/trust/saml2/http-post/sso/371755",
      //           cert: TEST_CERT,
      //           validateInResponseTo,
      //           issuer: "onesaml_login",
      //           wantAuthnResponseSigned: false,
      //         };
      //         const samlObj = new SAML(samlConfig);

      //         // Mock the SAML request being passed through Passport-SAML
      //         await samlObj.cacheProvider.saveAsync(requestId, new Date().toISOString());

      //         await assert.rejects(samlObj.validatePostResponseAsync(container), {
      //           message: "Invalid signature",
      //         });

      //         await assert.rejects(samlObj.validatePostResponseAsync(container), {
      //           message: "InResponseTo is not valid",
      //         });

      //         assert.strictEqual(await samlObj.cacheProvider.getAsync(requestId), null);
      //       });
      //     });
      //   }
      // );

      describe("validatePostResponse xml signature checks /", function () {
        const ALT_TEST_CERT =
          "MIIEOTCCAyGgAwIBAgIJAKZgJdKdCdL6MA0GCSqGSIb3DQEBBQUAMHAxCzAJBgNVBAYTAkFVMREwDwYDVQQIEwhWaWN0b3JpYTESMBAGA1UEBxMJTWVsYm91cm5lMSEwHwYDVQQKExhUYWJjb3JwIEhvbGRpbmdzIExpbWl0ZWQxFzAVBgNVBAMTDnN0cy50YWIuY29tLmF1MB4XDTE3MDUzMDA4NTQwOFoXDTI3MDUyODA4NTQwOFowcDELMAkGA1UEBhMCQVUxETAPBgNVBAgTCFZpY3RvcmlhMRIwEAYDVQQHEwlNZWxib3VybmUxITAfBgNVBAoTGFRhYmNvcnAgSG9sZGluZ3MgTGltaXRlZDEXMBUGA1UEAxMOc3RzLnRhYi5jb20uYXUwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQD0NuMcflq3rtupKYDf4a7lWmsXy66fYe9n8jB2DuLMakEJBlzn9j6B98IZftrilTq21VR7wUXROxG8BkN8IHY+l8X7lATmD28fFdZJj0c8Qk82eoq48faemth4fBMx2YrpnhU00jeXeP8dIIaJTPCHBTNgZltMMhphklN1YEPlzefJs3YD+Ryczy1JHbwETxt+BzO1JdjBe1fUTyl6KxAwWvtsNBURmQRYlDOk4GRgdkQnfxBuCpOMeOpV8wiBAi3h65Lab9C5avu4AJlA9e4qbOmWt6otQmgy5fiJVy6bH/d8uW7FJmSmePX9sqAWa9szhjdn36HHVQsfHC+IUEX7AgMBAAGjgdUwgdIwHQYDVR0OBBYEFN6z6cuxY7FTkg1S/lIjnS4x5ARWMIGiBgNVHSMEgZowgZeAFN6z6cuxY7FTkg1S/lIjnS4x5ARWoXSkcjBwMQswCQYDVQQGEwJBVTERMA8GA1UECBMIVmljdG9yaWExEjAQBgNVBAcTCU1lbGJvdXJuZTEhMB8GA1UEChMYVGFiY29ycCBIb2xkaW5ncyBMaW1pdGVkMRcwFQYDVQQDEw5zdHMudGFiLmNvbS5hdYIJAKZgJdKdCdL6MAwGA1UdEwQFMAMBAf8wDQYJKoZIhvcNAQEFBQADggEBAMi5HyvXgRa4+kKz3dk4SwAEXzeZRcsbeDJWVUxdb6a+JQxIoG7L9rSbd6yZvP/Xel5TrcwpCpl5eikzXB02/C0wZKWicNmDEBlOfw0Pc5ngdoh6ntxHIWm5QMlAfjR0dgTlojN4Msw2qk7cP1QEkV96e2BJUaqaNnM3zMvd7cfRjPNfbsbwl6hCCCAdwrALKYtBnjKVrCGPwO+xiw5mUJhZ1n6ZivTOdQEWbl26UO60J9ItiWP8VK0d0aChn326Ovt7qC4S3AgDlaJwcKe5Ifxl/UOWePGRwXj2UUuDWFhjtVmRntMmNZbe5yE8MkEvU+4/c6LqGwTCgDenRbK53Dg=";
        let fakeClock: sinon.SinonFakeTimers;

        beforeEach(function () {
          fakeClock = sinon.useFakeTimers(Date.parse("2014-05-28T00:13:09Z"));
        });
        afterEach(function () {
          fakeClock.restore();
        });

        const samlConfig: SamlConfig = {
          entryPoint: "https://app.onelogin.com/trust/saml2/http-post/sso/371755",
          cert: TEST_CERT,
          audience: false,
          issuer: "onesaml_login",
          wantAuthnResponseSigned: false,
        };
        const noAudienceSamlConfig: SamlConfig = {
          entryPoint: "https://app.onelogin.com/trust/saml2/http-post/sso/371755",
          cert: TEST_CERT,
          issuer: "onesaml_login",
          wantAuthnResponseSigned: false,
        };
        const noCertSamlConfig: SamlConfig = {
          entryPoint: "https://app.onelogin.com/trust/saml2/http-post/sso/371755",
          audience: false,
          issuer: "onesaml_login",
        } as SamlConfig;
        const badCertSamlConfig: SamlConfig = {
          entryPoint: "https://app.onelogin.com/trust/saml2/http-post/sso/371755",
          cert: BAD_TEST_CERT,
          audience: false,
          issuer: "onesaml_login",
        };

        it("if audience, then it must match", async () => {
          const xml =
            '<samlp:Response xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="R689b0733bccca22a137e3654830312332940b1be" Version="2.0" IssueInstant="2014-05-28T00:16:08Z" Destination="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>' +
            '<saml:Assertion xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="2.0" ID="pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa" IssueInstant="2014-05-28T00:16:08Z"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/><ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><ds:Reference URI="#pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa"><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><ds:DigestValue>DCnPTQYBb1hKspbe6fg1U3q8xn4=</ds:DigestValue></ds:Reference></ds:SignedInfo><ds:SignatureValue>e0+aFomA0+JAY0f9tKqzIuqIVSSw7LiFUsneEDKPBWdiTz1sMdgr/2y1e9+rjaS2mRmCi/vSQLY3zTYz0hp6nJNU19+TWoXo9kHQyWT4KkeQL4Xs/gZ/AoKC20iHVKtpPps0IQ0Ml/qRoouSitt6Sf/WDz2LV/pWcH2hx5tv3xSw36hK2NQc7qw7r1mEXnvcjXReYo8rrVf7XHGGxNoRIEICUIi110uvsWemSXf0Z0dyb0FVYOWuSsQMDlzNpheADBifFO4UTfSEhFZvn8kVCGZUIwrbOhZ2d/+YEtgyuTg+qtslgfy4dwd4TvEcfuRzQTazeefprSFyiQckAXOjcw==</ds:SignatureValue><ds:KeyInfo><ds:X509Data><ds:X509Certificate>' +
            TEST_CERT +
            '</ds:X509Certificate></ds:X509Data></ds:KeyInfo></ds:Signature><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">ploer@subspacesw.com</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData NotOnOrAfter="2014-05-28T00:19:08Z" Recipient="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"/></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="2014-05-28T00:13:08Z" NotOnOrAfter="2014-05-28T00:19:08Z"><saml:AudienceRestriction><saml:Audience>{audience}</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AuthnStatement AuthnInstant="2014-05-28T00:16:07Z" SessionNotOnOrAfter="2014-05-29T00:16:08Z" SessionIndex="_30a4af50-c82b-0131-f8b5-782bcb56fcaa"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement></saml:Assertion>' +
            "</samlp:Response>";
          const base64xml = Buffer.from(xml).toString("base64");
          const container = { SAMLResponse: base64xml };
          const samlObj = new SAML({ ...noAudienceSamlConfig, audience: "{audience}" });
          const { profile } = await samlObj.validatePostResponseAsync(container);
          expect(profile?.nameID).to.not.be.empty;
        });

        it("if audience, then it must throw if it doesn't match", async () => {
          const xml =
            '<samlp:Response xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="R689b0733bccca22a137e3654830312332940b1be" Version="2.0" IssueInstant="2014-05-28T00:16:08Z" Destination="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>' +
            '<saml:Assertion xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="2.0" ID="pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa" IssueInstant="2014-05-28T00:16:08Z"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/><ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><ds:Reference URI="#pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa"><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><ds:DigestValue>DCnPTQYBb1hKspbe6fg1U3q8xn4=</ds:DigestValue></ds:Reference></ds:SignedInfo><ds:SignatureValue>e0+aFomA0+JAY0f9tKqzIuqIVSSw7LiFUsneEDKPBWdiTz1sMdgr/2y1e9+rjaS2mRmCi/vSQLY3zTYz0hp6nJNU19+TWoXo9kHQyWT4KkeQL4Xs/gZ/AoKC20iHVKtpPps0IQ0Ml/qRoouSitt6Sf/WDz2LV/pWcH2hx5tv3xSw36hK2NQc7qw7r1mEXnvcjXReYo8rrVf7XHGGxNoRIEICUIi110uvsWemSXf0Z0dyb0FVYOWuSsQMDlzNpheADBifFO4UTfSEhFZvn8kVCGZUIwrbOhZ2d/+YEtgyuTg+qtslgfy4dwd4TvEcfuRzQTazeefprSFyiQckAXOjcw==</ds:SignatureValue><ds:KeyInfo><ds:X509Data><ds:X509Certificate>' +
            TEST_CERT +
            '</ds:X509Certificate></ds:X509Data></ds:KeyInfo></ds:Signature><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">ploer@subspacesw.com</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData NotOnOrAfter="2014-05-28T00:19:08Z" Recipient="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"/></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="2014-05-28T00:13:08Z" NotOnOrAfter="2014-05-28T00:19:08Z"><saml:AudienceRestriction><saml:Audience>{audience}</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AuthnStatement AuthnInstant="2014-05-28T00:16:07Z" SessionNotOnOrAfter="2014-05-29T00:16:08Z" SessionIndex="_30a4af50-c82b-0131-f8b5-782bcb56fcaa"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement></saml:Assertion>' +
            "</samlp:Response>";
          const base64xml = Buffer.from(xml).toString("base64");
          const container = { SAMLResponse: base64xml };
          try {
            const samlObj = new SAML({ ...noAudienceSamlConfig, audience: "no match" });
            const { profile } = await samlObj.validatePostResponseAsync(container);
            expect(profile).to.not.exist;
          } catch (err: unknown) {
            expect(err).to.exist;
            expect(err).to.be.instanceOf(Error);
            expect((err as Error).message).to.match(/SAML assertion audience mismatch/);
          }
        });

        it("if audience and issuer not provided, fail", async () => {
          const xml =
            '<samlp:Response xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="R689b0733bccca22a137e3654830312332940b1be" Version="2.0" IssueInstant="2014-05-28T00:16:08Z" Destination="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>' +
            '<saml:Assertion xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="2.0" ID="pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa" IssueInstant="2014-05-28T00:16:08Z"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/><ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><ds:Reference URI="#pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa"><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><ds:DigestValue>DCnPTQYBb1hKspbe6fg1U3q8xn4=</ds:DigestValue></ds:Reference></ds:SignedInfo><ds:SignatureValue>e0+aFomA0+JAY0f9tKqzIuqIVSSw7LiFUsneEDKPBWdiTz1sMdgr/2y1e9+rjaS2mRmCi/vSQLY3zTYz0hp6nJNU19+TWoXo9kHQyWT4KkeQL4Xs/gZ/AoKC20iHVKtpPps0IQ0Ml/qRoouSitt6Sf/WDz2LV/pWcH2hx5tv3xSw36hK2NQc7qw7r1mEXnvcjXReYo8rrVf7XHGGxNoRIEICUIi110uvsWemSXf0Z0dyb0FVYOWuSsQMDlzNpheADBifFO4UTfSEhFZvn8kVCGZUIwrbOhZ2d/+YEtgyuTg+qtslgfy4dwd4TvEcfuRzQTazeefprSFyiQckAXOjcw==</ds:SignatureValue><ds:KeyInfo><ds:X509Data><ds:X509Certificate>' +
            TEST_CERT +
            '</ds:X509Certificate></ds:X509Data></ds:KeyInfo></ds:Signature><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">ploer@subspacesw.com</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData NotOnOrAfter="2014-05-28T00:19:08Z" Recipient="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"/></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="2014-05-28T00:13:08Z" NotOnOrAfter="2014-05-28T00:19:08Z"><saml:AudienceRestriction><saml:Audience>{audience}</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AuthnStatement AuthnInstant="2014-05-28T00:16:07Z" SessionNotOnOrAfter="2014-05-29T00:16:08Z" SessionIndex="_30a4af50-c82b-0131-f8b5-782bcb56fcaa"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement></saml:Assertion>' +
            "</samlp:Response>";
          const base64xml = Buffer.from(xml).toString("base64");
          const container = { SAMLResponse: base64xml };
          try {
            const samlObj = new SAML({ ...noAudienceSamlConfig });
            const { profile } = await samlObj.validatePostResponseAsync(container);
            expect(profile).to.not.exist;
          } catch (err) {
            expect(err).to.exist;
            expect(err).to.be.instanceOf(Error);
            expect((err as Error).message).to.match(/SAML assertion audience mismatch/);
          }
        });

        it("if audience not provided, use issuer, and fail", async () => {
          const xml =
            '<samlp:Response xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="R689b0733bccca22a137e3654830312332940b1be" Version="2.0" IssueInstant="2014-05-28T00:16:08Z" Destination="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>' +
            '<saml:Assertion xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="2.0" ID="pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa" IssueInstant="2014-05-28T00:16:08Z"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/><ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><ds:Reference URI="#pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa"><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><ds:DigestValue>DCnPTQYBb1hKspbe6fg1U3q8xn4=</ds:DigestValue></ds:Reference></ds:SignedInfo><ds:SignatureValue>e0+aFomA0+JAY0f9tKqzIuqIVSSw7LiFUsneEDKPBWdiTz1sMdgr/2y1e9+rjaS2mRmCi/vSQLY3zTYz0hp6nJNU19+TWoXo9kHQyWT4KkeQL4Xs/gZ/AoKC20iHVKtpPps0IQ0Ml/qRoouSitt6Sf/WDz2LV/pWcH2hx5tv3xSw36hK2NQc7qw7r1mEXnvcjXReYo8rrVf7XHGGxNoRIEICUIi110uvsWemSXf0Z0dyb0FVYOWuSsQMDlzNpheADBifFO4UTfSEhFZvn8kVCGZUIwrbOhZ2d/+YEtgyuTg+qtslgfy4dwd4TvEcfuRzQTazeefprSFyiQckAXOjcw==</ds:SignatureValue><ds:KeyInfo><ds:X509Data><ds:X509Certificate>' +
            TEST_CERT +
            '</ds:X509Certificate></ds:X509Data></ds:KeyInfo></ds:Signature><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">ploer@subspacesw.com</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData NotOnOrAfter="2014-05-28T00:19:08Z" Recipient="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"/></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="2014-05-28T00:13:08Z" NotOnOrAfter="2014-05-28T00:19:08Z"><saml:AudienceRestriction><saml:Audience>{audience}</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AuthnStatement AuthnInstant="2014-05-28T00:16:07Z" SessionNotOnOrAfter="2014-05-29T00:16:08Z" SessionIndex="_30a4af50-c82b-0131-f8b5-782bcb56fcaa"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement></saml:Assertion>' +
            "</samlp:Response>";
          const base64xml = Buffer.from(xml).toString("base64");
          const container = { SAMLResponse: base64xml };
          try {
            const samlObj = new SAML({
              ...noAudienceSamlConfig,
              issuer:
                "SP issuer value which doesn't match values at audience fields i.e. IdP did not add this SP's entityId to audience list",
            });
            const { profile } = await samlObj.validatePostResponseAsync(container);
            expect(profile).to.not.exist;
          } catch (err) {
            expect(err).to.exist;
            expect(err).to.be.instanceOf(Error);
            expect((err as Error).message).to.match(/SAML assertion audience mismatch/);
          }
        });

        it("if audience not provided, use issuer, and succeed", async () => {
          const xml =
            '<samlp:Response xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="R689b0733bccca22a137e3654830312332940b1be" Version="2.0" IssueInstant="2014-05-28T00:16:08Z" Destination="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>' +
            '<saml:Assertion xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="2.0" ID="pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa" IssueInstant="2014-05-28T00:16:08Z"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/><ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><ds:Reference URI="#pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa"><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><ds:DigestValue>DCnPTQYBb1hKspbe6fg1U3q8xn4=</ds:DigestValue></ds:Reference></ds:SignedInfo><ds:SignatureValue>e0+aFomA0+JAY0f9tKqzIuqIVSSw7LiFUsneEDKPBWdiTz1sMdgr/2y1e9+rjaS2mRmCi/vSQLY3zTYz0hp6nJNU19+TWoXo9kHQyWT4KkeQL4Xs/gZ/AoKC20iHVKtpPps0IQ0Ml/qRoouSitt6Sf/WDz2LV/pWcH2hx5tv3xSw36hK2NQc7qw7r1mEXnvcjXReYo8rrVf7XHGGxNoRIEICUIi110uvsWemSXf0Z0dyb0FVYOWuSsQMDlzNpheADBifFO4UTfSEhFZvn8kVCGZUIwrbOhZ2d/+YEtgyuTg+qtslgfy4dwd4TvEcfuRzQTazeefprSFyiQckAXOjcw==</ds:SignatureValue><ds:KeyInfo><ds:X509Data><ds:X509Certificate>' +
            TEST_CERT +
            '</ds:X509Certificate></ds:X509Data></ds:KeyInfo></ds:Signature><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">ploer@subspacesw.com</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData NotOnOrAfter="2014-05-28T00:19:08Z" Recipient="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"/></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="2014-05-28T00:13:08Z" NotOnOrAfter="2014-05-28T00:19:08Z"><saml:AudienceRestriction><saml:Audience>{audience}</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AuthnStatement AuthnInstant="2014-05-28T00:16:07Z" SessionNotOnOrAfter="2014-05-29T00:16:08Z" SessionIndex="_30a4af50-c82b-0131-f8b5-782bcb56fcaa"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement></saml:Assertion>' +
            "</samlp:Response>";
          const base64xml = Buffer.from(xml).toString("base64");
          const container = { SAMLResponse: base64xml };
          const samlObj = new SAML({
            ...noAudienceSamlConfig,
            issuer: "{audience}",
          });
          const { profile } = await samlObj.validatePostResponseAsync(container);
          expect(profile?.nameID).to.not.be.empty;
        });

        it("must have a cert to construct a SAML object", function () {
          try {
            new SAML(noCertSamlConfig);
          } catch (err: unknown) {
            expect(err).to.exist;
            expect(err).to.be.instanceOf(Error);
            expect((err as Error).message).to.match(/cert is required/);
          }
        });

        it("must have a valid cert to construct a SAML object", function () {
          try {
            new SAML(badCertSamlConfig);
          } catch (err: unknown) {
            expect(err).to.exist;
            expect(err).to.be.instanceOf(Error);
            expect((err as Error).message).to.match(/cert is required/);
          }
        });

        it("valid onelogin xml document should validate", async () => {
          const xml =
            '<samlp:Response xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="R689b0733bccca22a137e3654830312332940b1be" Version="2.0" IssueInstant="2014-05-28T00:16:08Z" Destination="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>' +
            '<saml:Assertion xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="2.0" ID="pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa" IssueInstant="2014-05-28T00:16:08Z"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/><ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><ds:Reference URI="#pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa"><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><ds:DigestValue>DCnPTQYBb1hKspbe6fg1U3q8xn4=</ds:DigestValue></ds:Reference></ds:SignedInfo><ds:SignatureValue>e0+aFomA0+JAY0f9tKqzIuqIVSSw7LiFUsneEDKPBWdiTz1sMdgr/2y1e9+rjaS2mRmCi/vSQLY3zTYz0hp6nJNU19+TWoXo9kHQyWT4KkeQL4Xs/gZ/AoKC20iHVKtpPps0IQ0Ml/qRoouSitt6Sf/WDz2LV/pWcH2hx5tv3xSw36hK2NQc7qw7r1mEXnvcjXReYo8rrVf7XHGGxNoRIEICUIi110uvsWemSXf0Z0dyb0FVYOWuSsQMDlzNpheADBifFO4UTfSEhFZvn8kVCGZUIwrbOhZ2d/+YEtgyuTg+qtslgfy4dwd4TvEcfuRzQTazeefprSFyiQckAXOjcw==</ds:SignatureValue><ds:KeyInfo><ds:X509Data><ds:X509Certificate>' +
            TEST_CERT +
            '</ds:X509Certificate></ds:X509Data></ds:KeyInfo></ds:Signature><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">ploer@subspacesw.com</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData NotOnOrAfter="2014-05-28T00:19:08Z" Recipient="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"/></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="2014-05-28T00:13:08Z" NotOnOrAfter="2014-05-28T00:19:08Z"><saml:AudienceRestriction><saml:Audience>{audience}</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AuthnStatement AuthnInstant="2014-05-28T00:16:07Z" SessionNotOnOrAfter="2014-05-29T00:16:08Z" SessionIndex="_30a4af50-c82b-0131-f8b5-782bcb56fcaa"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement></saml:Assertion>' +
            "</samlp:Response>";
          const base64xml = Buffer.from(xml).toString("base64");
          const container = { SAMLResponse: base64xml };
          const samlObj = new SAML(samlConfig);

          const { profile } = await samlObj.validatePostResponseAsync(container);
          assertRequired(profile, "profile must exist");
          expect(profile.nameID.startsWith("ploer")).to.be.true;
        });

        it("SAML creation should fail without cert", function () {
          try {
            new SAML(noCertSamlConfig);
          } catch (err: unknown) {
            expect(err).to.exist;
            expect(err).to.be.instanceOf(Error);
            expect((err as Error).message).to.match(/cert is required/);
          }
        });

        // it("onelogin xml document with altered NameID should fail", async () => {
        //   const xml =
        //     '<samlp:Response xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="R689b0733bccca22a137e3654830312332940b1be" Version="2.0" IssueInstant="2014-05-28T00:16:08Z" Destination="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>' +
        //     '<saml:Assertion xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="2.0" ID="pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa" IssueInstant="2014-05-28T00:16:08Z"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/><ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><ds:Reference URI="#pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa"><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><ds:DigestValue>DCnPTQYBb1hKspbe6fg1U3q8xn4=</ds:DigestValue></ds:Reference></ds:SignedInfo><ds:SignatureValue>e0+aFomA0+JAY0f9tKqzIuqIVSSw7LiFUsneEDKPBWdiTz1sMdgr/2y1e9+rjaS2mRmCi/vSQLY3zTYz0hp6nJNU19+TWoXo9kHQyWT4KkeQL4Xs/gZ/AoKC20iHVKtpPps0IQ0Ml/qRoouSitt6Sf/WDz2LV/pWcH2hx5tv3xSw36hK2NQc7qw7r1mEXnvcjXReYo8rrVf7XHGGxNoRIEICUIi110uvsWemSXf0Z0dyb0FVYOWuSsQMDlzNpheADBifFO4UTfSEhFZvn8kVCGZUIwrbOhZ2d/+YEtgyuTg+qtslgfy4dwd4TvEcfuRzQTazeefprSFyiQckAXOjcw==</ds:SignatureValue><ds:KeyInfo><ds:X509Data><ds:X509Certificate>' +
        //     TEST_CERT +
        //     '</ds:X509Certificate></ds:X509Data></ds:KeyInfo></ds:Signature><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">aaaaaaaa@bbbbb.local</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData NotOnOrAfter="2014-05-28T00:19:08Z" Recipient="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"/></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="2014-05-28T00:13:08Z" NotOnOrAfter="2014-05-28T00:19:08Z"><saml:AudienceRestriction><saml:Audience>{audience}</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AuthnStatement AuthnInstant="2014-05-28T00:16:07Z" SessionNotOnOrAfter="2014-05-29T00:16:08Z" SessionIndex="_30a4af50-c82b-0131-f8b5-782bcb56fcaa"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement></saml:Assertion>' +
        //     "</samlp:Response>";
        //   const base64xml = Buffer.from(xml).toString("base64");
        //   const container = { SAMLResponse: base64xml };
        //   const samlObj = new SAML(samlConfig);
        //   await assert.rejects(samlObj.validatePostResponseAsync(container), /Invalid signature/);
        // });

        // it("onelogin xml document with altered assertion name should fail", async () => {
        //   const xml =
        //     '<samlp:Response xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="R689b0733bccca22a137e3654830312332940b1be" Version="2.0" IssueInstant="2014-05-28T00:16:08Z" Destination="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>' +
        //     '<saml:Assertion xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="2.0" ID="pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa" IssueInstant="2014-05-28T00:16:08Z"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/><ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><ds:Reference URI="#pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa"><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><ds:DigestValue>DCnPTQYBb1hKspbe6fg1U3q8xn4=</ds:DigestValue></ds:Reference></ds:SignedInfo><ds:SignatureValue>e0+aFomA0+JAY0f9tKqzIuqIVSSw7LiFUsneEDKPBWdiTz1sMdgr/2y1e9+rjaS2mRmCi/vSQLY3zTYz0hp6nJNU19+TWoXo9kHQyWT4KkeQL4Xs/gZ/AoKC20iHVKtpPps0IQ0Ml/qRoouSitt6Sf/WDz2LV/pWcH2hx5tv3xSw36hK2NQc7qw7r1mEXnvcjXReYo8rrVf7XHGGxNoRIEICUIi110uvsWemSXf0Z0dyb0FVYOWuSsQMDlzNpheADBifFO4UTfSEhFZvn8kVCGZUIwrbOhZ2d/+YEtgyuTg+qtslgfy4dwd4TvEcfuRzQTazeefprSFyiQckAXOjcw==</ds:SignatureValue><ds:KeyInfo><ds:X509Data><ds:X509Certificate>' +
        //     TEST_CERT +
        //     '</ds:X509Certificate></ds:X509Data></ds:KeyInfo></ds:Signature><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">aaaaaaaa@bbbbb.local</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData NotOnOrAfter="2014-05-28T00:19:08Z" Recipient="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"/></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="2014-05-28T00:13:08Z" NotOnOrAfter="2014-05-28T00:19:08Z"><saml:AudienceRestriction><saml:Audience>{audience}</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AuthnStatement AuthnInstant="2014-05-28T00:16:07Z" SessionNotOnOrAfter="2014-05-29T00:16:08Z" SessionIndex="_30a4af50-c82b-0131-f8b5-782bcb56fcaa"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement></saml:Assertion>' +
        //     "</samlp:Response>";
        //   const base64xml = Buffer.from(xml).toString("base64");
        //   const container = { SAMLResponse: base64xml };
        //   const samlObj = new SAML(samlConfig);
        //   await assert.rejects(samlObj.validatePostResponseAsync(container), /Invalid signature/);
        // });

        // it("onelogin xml document with altered assertion should fail", async () => {
        //   const xml =
        //     '<samlp:Response xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="R689b0733bccca22a137e3654830312332940b1be" Version="2.0" IssueInstant="2014-05-28T00:16:08Z" Destination="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>' +
        //     '<saml:Assertion xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="2.0" ID="pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa" IssueInstant="2014-05-28T00:16:08Z"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/><ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><ds:Reference URI="#pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa"><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><ds:DigestValue>DCnPTQYBb1hKspbe6fg1U3q8xn4=</ds:DigestValue></ds:Reference></ds:SignedInfo><ds:SignatureValue>e0+aFomA0+JAY0f9tKqzIuqIVSSw7LiFUsneEDKPBWdiTz1sMdgr/2y1e9+rjaS2mRmCi/vSQLY3zTYz0hp6nJNU19+TWoXo9kHQyWT4KkeQL4Xs/gZ/AoKC20iHVKtpPps0IQ0Ml/qRoouSitt6Sf/WDz2LV/pWcH2hx5tv3xSw36hK2NQc7qw7r1mEXnvcjXReYo8rrVf7XHGGxNoRIEICUIi110uvsWemSXf0Z0dyb0FVYOWuSsQMDlzNpheADBifFO4UTfSEhFZvn8kVCGZUIwrbOhZ2d/+YEtgyuTg+qtslgfy4dwd4TvEcfuRzQTazeefprSFyiQckAXOjcw==</ds:SignatureValue><ds:KeyInfo><ds:X509Data><ds:X509Certificate>' +
        //     TEST_CERT +
        //     '</ds:X509Certificate></ds:X509Data></ds:KeyInfo></ds:Signature><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">ben@subspacesw.com</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData NotOnOrAfter="2014-05-28T00:19:08Z" Recipient="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"/></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="2014-05-28T00:13:08Z" NotOnOrAfter="2014-05-28T00:19:08Z"><saml:AudienceRestriction><saml:Audience>{audience}</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AuthnStatement AuthnInstant="2014-05-28T00:16:07Z" SessionNotOnOrAfter="2014-05-29T00:16:08Z" SessionIndex="_30a4af50-c82b-0131-f8b5-782bcb56fcaa"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement></saml:Assertion>' +
        //     "</samlp:Response>";
        //   const base64xml = Buffer.from(xml).toString("base64");
        //   const container = { SAMLResponse: base64xml };
        //   const samlObj = new SAML(samlConfig);
        //   await assert.rejects(samlObj.validatePostResponseAsync(container), /Invalid signature/);
        // });

        it("onelogin xml document with duplicate altered assertion should fail", async () => {
          const xml =
            '<samlp:Response xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="R689b0733bccca22a137e3654830312332940b1be" Version="2.0" IssueInstant="2014-05-28T00:16:08Z" Destination="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>' +
            '<saml:Assertion xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="2.0" ID="pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa" IssueInstant="2014-05-28T00:16:08Z"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/><ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><ds:Reference URI="#pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa"><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><ds:DigestValue>DCnPTQYBb1hKspbe6fg1U3q8xn4=</ds:DigestValue></ds:Reference></ds:SignedInfo><ds:SignatureValue>e0+aFomA0+JAY0f9tKqzIuqIVSSw7LiFUsneEDKPBWdiTz1sMdgr/2y1e9+rjaS2mRmCi/vSQLY3zTYz0hp6nJNU19+TWoXo9kHQyWT4KkeQL4Xs/gZ/AoKC20iHVKtpPps0IQ0Ml/qRoouSitt6Sf/WDz2LV/pWcH2hx5tv3xSw36hK2NQc7qw7r1mEXnvcjXReYo8rrVf7XHGGxNoRIEICUIi110uvsWemSXf0Z0dyb0FVYOWuSsQMDlzNpheADBifFO4UTfSEhFZvn8kVCGZUIwrbOhZ2d/+YEtgyuTg+qtslgfy4dwd4TvEcfuRzQTazeefprSFyiQckAXOjcw==</ds:SignatureValue><ds:KeyInfo><ds:X509Data><ds:X509Certificate>' +
            TEST_CERT +
            '</ds:X509Certificate></ds:X509Data></ds:KeyInfo></ds:Signature><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">ploer@subspacesw.com</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData NotOnOrAfter="2014-05-28T00:19:08Z" Recipient="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"/></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="2014-05-28T00:13:08Z" NotOnOrAfter="2014-05-28T00:19:08Z"><saml:AudienceRestriction><saml:Audience>{audience}</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AuthnStatement AuthnInstant="2014-05-28T00:16:07Z" SessionNotOnOrAfter="2014-05-29T00:16:08Z" SessionIndex="_30a4af50-c82b-0131-f8b5-782bcb56fcaa"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement></saml:Assertion>' +
            '<saml:Assertion xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="2.0" ID="pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa" IssueInstant="2014-05-28T00:16:08Z"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/><ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><ds:Reference URI="#pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa"><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><ds:DigestValue>DCnPTQYBb1hKspbe6fg1U3q8xn4=</ds:DigestValue></ds:Reference></ds:SignedInfo><ds:SignatureValue>e0+aFomA0+JAY0f9tKqzIuqIVSSw7LiFUsneEDKPBWdiTz1sMdgr/2y1e9+rjaS2mRmCi/vSQLY3zTYz0hp6nJNU19+TWoXo9kHQyWT4KkeQL4Xs/gZ/AoKC20iHVKtpPps0IQ0Ml/qRoouSitt6Sf/WDz2LV/pWcH2hx5tv3xSw36hK2NQc7qw7r1mEXnvcjXReYo8rrVf7XHGGxNoRIEICUIi110uvsWemSXf0Z0dyb0FVYOWuSsQMDlzNpheADBifFO4UTfSEhFZvn8kVCGZUIwrbOhZ2d/+YEtgyuTg+qtslgfy4dwd4TvEcfuRzQTazeefprSFyiQckAXOjcw==</ds:SignatureValue><ds:KeyInfo><ds:X509Data><ds:X509Certificate>' +
            TEST_CERT +
            '</ds:X509Certificate></ds:X509Data></ds:KeyInfo></ds:Signature><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">ben@subspacesw.com</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData NotOnOrAfter="2014-05-28T00:19:08Z" Recipient="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"/></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="2014-05-28T00:13:08Z" NotOnOrAfter="2014-05-28T00:19:08Z"><saml:AudienceRestriction><saml:Audience>{audience}</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AuthnStatement AuthnInstant="2014-05-28T00:16:07Z" SessionNotOnOrAfter="2014-05-29T00:16:08Z" SessionIndex="_30a4af50-c82b-0131-f8b5-782bcb56fcaa"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement></saml:Assertion>' +
            "</samlp:Response>";
          const base64xml = Buffer.from(xml).toString("base64");
          const container = { SAMLResponse: base64xml };
          const samlObj = new SAML(samlConfig);
          await assert.rejects(samlObj.validatePostResponseAsync(container), /Invalid signature/);
        });

        it("onelogin xml document with extra unsigned & altered assertion should fail", async () => {
          const xml =
            '<samlp:Response xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="R689b0733bccca22a137e3654830312332940b1be" Version="2.0" IssueInstant="2014-05-28T00:16:08Z" Destination="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>' +
            '<saml:Assertion xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="2.0" ID="pfx3b63c7be-fe86-62fd-8cb5-16ab6273efab" IssueInstant="2014-05-28T00:16:08Z"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">ben@subspacesw.com</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData NotOnOrAfter="2014-05-28T00:19:08Z" Recipient="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"/></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="2014-05-28T00:13:08Z" NotOnOrAfter="2014-05-28T00:19:08Z"><saml:AudienceRestriction><saml:Audience>{audience}</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AuthnStatement AuthnInstant="2014-05-28T00:16:07Z" SessionNotOnOrAfter="2014-05-29T00:16:08Z" SessionIndex="_30a4af50-c82b-0131-f8b5-782bcb56fcaa"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement></saml:Assertion>' +
            '<saml:Assertion xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="2.0" ID="pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa" IssueInstant="2014-05-28T00:16:08Z"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/><ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><ds:Reference URI="#pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa"><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><ds:DigestValue>DCnPTQYBb1hKspbe6fg1U3q8xn4=</ds:DigestValue></ds:Reference></ds:SignedInfo><ds:SignatureValue>e0+aFomA0+JAY0f9tKqzIuqIVSSw7LiFUsneEDKPBWdiTz1sMdgr/2y1e9+rjaS2mRmCi/vSQLY3zTYz0hp6nJNU19+TWoXo9kHQyWT4KkeQL4Xs/gZ/AoKC20iHVKtpPps0IQ0Ml/qRoouSitt6Sf/WDz2LV/pWcH2hx5tv3xSw36hK2NQc7qw7r1mEXnvcjXReYo8rrVf7XHGGxNoRIEICUIi110uvsWemSXf0Z0dyb0FVYOWuSsQMDlzNpheADBifFO4UTfSEhFZvn8kVCGZUIwrbOhZ2d/+YEtgyuTg+qtslgfy4dwd4TvEcfuRzQTazeefprSFyiQckAXOjcw==</ds:SignatureValue><ds:KeyInfo><ds:X509Data><ds:X509Certificate>' +
            TEST_CERT +
            '</ds:X509Certificate></ds:X509Data></ds:KeyInfo></ds:Signature><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">ploer@subspacesw.com</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData NotOnOrAfter="2014-05-28T00:19:08Z" Recipient="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"/></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="2014-05-28T00:13:08Z" NotOnOrAfter="2014-05-28T00:19:08Z"><saml:AudienceRestriction><saml:Audience>{audience}</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AuthnStatement AuthnInstant="2014-05-28T00:16:07Z" SessionNotOnOrAfter="2014-05-29T00:16:08Z" SessionIndex="_30a4af50-c82b-0131-f8b5-782bcb56fcaa"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement></saml:Assertion>' +
            "</samlp:Response>";
          const base64xml = Buffer.from(xml).toString("base64");
          const container = { SAMLResponse: base64xml };
          const samlObj = new SAML(samlConfig);
          await assert.rejects(samlObj.validatePostResponseAsync(container), /Invalid signature/);
        });

        // it("onelogin xml document with extra nexted assertion should fail", async () => {
        //   const xml =
        //     '<samlp:Response xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="R689b0733bccca22a137e3654830312332940b1be" Version="2.0" IssueInstant="2014-05-28T00:16:08Z" Destination="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>' +
        //     '<saml:Assertion xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="2.0" ID="pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa" IssueInstant="2014-05-28T00:16:08Z"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/><ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><ds:Reference URI="#pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa"><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><ds:DigestValue>DCnPTQYBb1hKspbe6fg1U3q8xn4=</ds:DigestValue></ds:Reference></ds:SignedInfo><ds:SignatureValue>e0+aFomA0+JAY0f9tKqzIuqIVSSw7LiFUsneEDKPBWdiTz1sMdgr/2y1e9+rjaS2mRmCi/vSQLY3zTYz0hp6nJNU19+TWoXo9kHQyWT4KkeQL4Xs/gZ/AoKC20iHVKtpPps0IQ0Ml/qRoouSitt6Sf/WDz2LV/pWcH2hx5tv3xSw36hK2NQc7qw7r1mEXnvcjXReYo8rrVf7XHGGxNoRIEICUIi110uvsWemSXf0Z0dyb0FVYOWuSsQMDlzNpheADBifFO4UTfSEhFZvn8kVCGZUIwrbOhZ2d/+YEtgyuTg+qtslgfy4dwd4TvEcfuRzQTazeefprSFyiQckAXOjcw==</ds:SignatureValue><ds:KeyInfo><ds:X509Data><ds:X509Certificate>' +
        //     TEST_CERT +
        //     "</ds:X509Certificate></ds:X509Data></ds:KeyInfo>" +
        //     "<ds:Object>" +
        //     '<saml:Assertion xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="2.0" ID="pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa" IssueInstant="2014-05-28T00:16:08Z"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">ploer@subspacesw.com</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData NotOnOrAfter="2014-05-28T00:19:08Z" Recipient="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"/></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="2014-05-28T00:13:08Z" NotOnOrAfter="2014-05-28T00:19:08Z"><saml:AudienceRestriction><saml:Audience>{audience}</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AuthnStatement AuthnInstant="2014-05-28T00:16:07Z" SessionNotOnOrAfter="2014-05-29T00:16:08Z" SessionIndex="_30a4af50-c82b-0131-f8b5-782bcb56fcaa"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement></saml:Assertion>' +
        //     "</ds:Object>" +
        //     '</ds:Signature><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">ploer@subspacesw.com</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData NotOnOrAfter="2014-05-28T00:19:08Z" Recipient="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"/></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="2014-05-28T00:13:08Z" NotOnOrAfter="2014-05-28T00:19:08Z"><saml:AudienceRestriction><saml:Audience>{audience}</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AuthnStatement AuthnInstant="2014-05-28T00:16:07Z" SessionNotOnOrAfter="2014-05-29T00:16:08Z" SessionIndex="_30a4af50-c82b-0131-f8b5-782bcb56fcaa"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement></saml:Assertion>' +
        //     "</samlp:Response>";
        //   const base64xml = Buffer.from(xml).toString("base64");
        //   const container = { SAMLResponse: base64xml };
        //   const samlObj = new SAML(samlConfig);
        //   await assert.rejects(samlObj.validatePostResponseAsync(container), /Invalid signature/);
        // });

        it("multiple certs should validate with one of the certs", async () => {
          const multiCertSamlConfig: SamlConfig = {
            entryPoint: samlConfig.entryPoint,
            cert: [ALT_TEST_CERT, TEST_CERT],
            audience: false,
            issuer: "onesaml_login",
            wantAuthnResponseSigned: false,
          };
          const xml =
            '<samlp:Response xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="R689b0733bccca22a137e3654830312332940b1be" Version="2.0" IssueInstant="2014-05-28T00:16:08Z" Destination="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>' +
            '<saml:Assertion xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="2.0" ID="pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa" IssueInstant="2014-05-28T00:16:08Z"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/><ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><ds:Reference URI="#pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa"><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><ds:DigestValue>DCnPTQYBb1hKspbe6fg1U3q8xn4=</ds:DigestValue></ds:Reference></ds:SignedInfo><ds:SignatureValue>e0+aFomA0+JAY0f9tKqzIuqIVSSw7LiFUsneEDKPBWdiTz1sMdgr/2y1e9+rjaS2mRmCi/vSQLY3zTYz0hp6nJNU19+TWoXo9kHQyWT4KkeQL4Xs/gZ/AoKC20iHVKtpPps0IQ0Ml/qRoouSitt6Sf/WDz2LV/pWcH2hx5tv3xSw36hK2NQc7qw7r1mEXnvcjXReYo8rrVf7XHGGxNoRIEICUIi110uvsWemSXf0Z0dyb0FVYOWuSsQMDlzNpheADBifFO4UTfSEhFZvn8kVCGZUIwrbOhZ2d/+YEtgyuTg+qtslgfy4dwd4TvEcfuRzQTazeefprSFyiQckAXOjcw==</ds:SignatureValue><ds:KeyInfo><ds:X509Data><ds:X509Certificate>' +
            TEST_CERT +
            '</ds:X509Certificate></ds:X509Data></ds:KeyInfo></ds:Signature><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">ploer@subspacesw.com</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData NotOnOrAfter="2014-05-28T00:19:08Z" Recipient="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"/></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="2014-05-28T00:13:08Z" NotOnOrAfter="2014-05-28T00:19:08Z"><saml:AudienceRestriction><saml:Audience>{audience}</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AuthnStatement AuthnInstant="2014-05-28T00:16:07Z" SessionNotOnOrAfter="2014-05-29T00:16:08Z" SessionIndex="_30a4af50-c82b-0131-f8b5-782bcb56fcaa"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement></saml:Assertion>' +
            "</samlp:Response>";
          const base64xml = Buffer.from(xml).toString("base64");
          const container = { SAMLResponse: base64xml };
          const samlObj = new SAML(multiCertSamlConfig);
          const { profile } = await samlObj.validatePostResponseAsync(container);
          assertRequired(profile, "profile must exist");
          expect(profile.nameID.startsWith("ploer")).to.be.true;
        });

        it("cert as a function should validate with the returned cert", async () => {
          const functionCertSamlConfig: SamlConfig = {
            entryPoint: samlConfig.entryPoint,
            cert: function (callback) {
              callback(null, TEST_CERT);
            },
            audience: false,
            issuer: "onesaml_login",
            wantAuthnResponseSigned: false,
          };
          const xml =
            '<samlp:Response xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="R689b0733bccca22a137e3654830312332940b1be" Version="2.0" IssueInstant="2014-05-28T00:16:08Z" Destination="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>' +
            '<saml:Assertion xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="2.0" ID="pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa" IssueInstant="2014-05-28T00:16:08Z"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/><ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><ds:Reference URI="#pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa"><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><ds:DigestValue>DCnPTQYBb1hKspbe6fg1U3q8xn4=</ds:DigestValue></ds:Reference></ds:SignedInfo><ds:SignatureValue>e0+aFomA0+JAY0f9tKqzIuqIVSSw7LiFUsneEDKPBWdiTz1sMdgr/2y1e9+rjaS2mRmCi/vSQLY3zTYz0hp6nJNU19+TWoXo9kHQyWT4KkeQL4Xs/gZ/AoKC20iHVKtpPps0IQ0Ml/qRoouSitt6Sf/WDz2LV/pWcH2hx5tv3xSw36hK2NQc7qw7r1mEXnvcjXReYo8rrVf7XHGGxNoRIEICUIi110uvsWemSXf0Z0dyb0FVYOWuSsQMDlzNpheADBifFO4UTfSEhFZvn8kVCGZUIwrbOhZ2d/+YEtgyuTg+qtslgfy4dwd4TvEcfuRzQTazeefprSFyiQckAXOjcw==</ds:SignatureValue><ds:KeyInfo><ds:X509Data><ds:X509Certificate>' +
            TEST_CERT +
            '</ds:X509Certificate></ds:X509Data></ds:KeyInfo></ds:Signature><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">ploer@subspacesw.com</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData NotOnOrAfter="2014-05-28T00:19:08Z" Recipient="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"/></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="2014-05-28T00:13:08Z" NotOnOrAfter="2014-05-28T00:19:08Z"><saml:AudienceRestriction><saml:Audience>{audience}</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AuthnStatement AuthnInstant="2014-05-28T00:16:07Z" SessionNotOnOrAfter="2014-05-29T00:16:08Z" SessionIndex="_30a4af50-c82b-0131-f8b5-782bcb56fcaa"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement></saml:Assertion>' +
            "</samlp:Response>";
          const base64xml = Buffer.from(xml).toString("base64");
          const container = { SAMLResponse: base64xml };
          const samlObj = new SAML(functionCertSamlConfig);
          const { profile } = await samlObj.validatePostResponseAsync(container);
          assertRequired(profile, "profile must exist");
          expect(profile.nameID.startsWith("ploer")).to.be.true;
        });

        it("cert as a function should validate with one of the returned certs", async () => {
          const functionMultiCertSamlConfig: SamlConfig = {
            entryPoint: samlConfig.entryPoint,
            cert: function (callback) {
              callback(null, [ALT_TEST_CERT, TEST_CERT]);
            },
            audience: false,
            issuer: "onesaml_login",
            wantAuthnResponseSigned: false,
          };
          const xml =
            '<samlp:Response xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="R689b0733bccca22a137e3654830312332940b1be" Version="2.0" IssueInstant="2014-05-28T00:16:08Z" Destination="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>' +
            '<saml:Assertion xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="2.0" ID="pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa" IssueInstant="2014-05-28T00:16:08Z"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/><ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><ds:Reference URI="#pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa"><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><ds:DigestValue>DCnPTQYBb1hKspbe6fg1U3q8xn4=</ds:DigestValue></ds:Reference></ds:SignedInfo><ds:SignatureValue>e0+aFomA0+JAY0f9tKqzIuqIVSSw7LiFUsneEDKPBWdiTz1sMdgr/2y1e9+rjaS2mRmCi/vSQLY3zTYz0hp6nJNU19+TWoXo9kHQyWT4KkeQL4Xs/gZ/AoKC20iHVKtpPps0IQ0Ml/qRoouSitt6Sf/WDz2LV/pWcH2hx5tv3xSw36hK2NQc7qw7r1mEXnvcjXReYo8rrVf7XHGGxNoRIEICUIi110uvsWemSXf0Z0dyb0FVYOWuSsQMDlzNpheADBifFO4UTfSEhFZvn8kVCGZUIwrbOhZ2d/+YEtgyuTg+qtslgfy4dwd4TvEcfuRzQTazeefprSFyiQckAXOjcw==</ds:SignatureValue><ds:KeyInfo><ds:X509Data><ds:X509Certificate>' +
            TEST_CERT +
            '</ds:X509Certificate></ds:X509Data></ds:KeyInfo></ds:Signature><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">ploer@subspacesw.com</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData NotOnOrAfter="2014-05-28T00:19:08Z" Recipient="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"/></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="2014-05-28T00:13:08Z" NotOnOrAfter="2014-05-28T00:19:08Z"><saml:AudienceRestriction><saml:Audience>{audience}</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AuthnStatement AuthnInstant="2014-05-28T00:16:07Z" SessionNotOnOrAfter="2014-05-29T00:16:08Z" SessionIndex="_30a4af50-c82b-0131-f8b5-782bcb56fcaa"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement></saml:Assertion>' +
            "</samlp:Response>";
          const base64xml = Buffer.from(xml).toString("base64");
          const container = { SAMLResponse: base64xml };
          const samlObj = new SAML(functionMultiCertSamlConfig);
          const { profile } = await samlObj.validatePostResponseAsync(container);
          assertRequired(profile, "profile must exist");
          expect(profile.nameID.startsWith("ploer")).to.be.true;
        });

        it("cert as a function should return an error if the cert function returns an error", async () => {
          const errorToReturn = new Error("test");
          const functionErrorCertSamlConfig: SamlConfig = {
            entryPoint: samlConfig.entryPoint,
            cert: function (callback) {
              callback(errorToReturn);
            },
            issuer: "onesaml_login",
          };
          const xml =
            '<samlp:Response xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="R689b0733bccca22a137e3654830312332940b1be" Version="2.0" IssueInstant="2014-05-28T00:16:08Z" Destination="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>' +
            '<saml:Assertion xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="2.0" ID="pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa" IssueInstant="2014-05-28T00:16:08Z"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/><ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><ds:Reference URI="#pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa"><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><ds:DigestValue>DCnPTQYBb1hKspbe6fg1U3q8xn4=</ds:DigestValue></ds:Reference></ds:SignedInfo><ds:SignatureValue>e0+aFomA0+JAY0f9tKqzIuqIVSSw7LiFUsneEDKPBWdiTz1sMdgr/2y1e9+rjaS2mRmCi/vSQLY3zTYz0hp6nJNU19+TWoXo9kHQyWT4KkeQL4Xs/gZ/AoKC20iHVKtpPps0IQ0Ml/qRoouSitt6Sf/WDz2LV/pWcH2hx5tv3xSw36hK2NQc7qw7r1mEXnvcjXReYo8rrVf7XHGGxNoRIEICUIi110uvsWemSXf0Z0dyb0FVYOWuSsQMDlzNpheADBifFO4UTfSEhFZvn8kVCGZUIwrbOhZ2d/+YEtgyuTg+qtslgfy4dwd4TvEcfuRzQTazeefprSFyiQckAXOjcw==</ds:SignatureValue><ds:KeyInfo><ds:X509Data><ds:X509Certificate>' +
            TEST_CERT +
            '</ds:X509Certificate></ds:X509Data></ds:KeyInfo></ds:Signature><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">ploer@subspacesw.com</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData NotOnOrAfter="2014-05-28T00:19:08Z" Recipient="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"/></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="2014-05-28T00:13:08Z" NotOnOrAfter="2014-05-28T00:19:08Z"><saml:AudienceRestriction><saml:Audience>{audience}</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AuthnStatement AuthnInstant="2014-05-28T00:16:07Z" SessionNotOnOrAfter="2014-05-29T00:16:08Z" SessionIndex="_30a4af50-c82b-0131-f8b5-782bcb56fcaa"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement></saml:Assertion>' +
            "</samlp:Response>";
          const base64xml = Buffer.from(xml).toString("base64");
          const container = { SAMLResponse: base64xml };
          const samlObj = new SAML(functionErrorCertSamlConfig);
          try {
            await samlObj.validatePostResponseAsync(container);
            expect(true).to.not.exist;
          } catch (err) {
            expect(err).to.exist;
            expect(err).to.equal(errorToReturn);
          }
        });

        it("XML AttributeValue should return object", async () => {
          const nameid_opaque_string = "*******************************";
          const nameQualifier = "https://idp.example.org/idp/saml";
          const spNameQualifier = "https://sp.example.org/sp/entity";
          const format = "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent";
          const xml =
            '<Response xmlns="urn:oasis:names:tc:SAML:2.0:protocol" ID="response0">' +
            '<saml2:Assertion xmlns:saml2="urn:oasis:names:tc:SAML:2.0:assertion" Version="2.0" ID="assertion0">' +
            "<saml2:AttributeStatement>" +
            '<saml2:Attribute FriendlyName="eduPersonTargetedID" Name="urn:oid:1.3.6.1.4.1.5923.1.1.1.10" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:uri">' +
            "<saml2:AttributeValue>" +
            '<saml2:NameID Format="' +
            format +
            '" NameQualifier="' +
            nameQualifier +
            '" SPNameQualifier="' +
            spNameQualifier +
            '">' +
            nameid_opaque_string +
            "</saml2:NameID>" +
            "</saml2:AttributeValue>" +
            "</saml2:Attribute>" +
            "</saml2:AttributeStatement>" +
            "</saml2:Assertion>" +
            "</Response>";

          const signingKey = fs.readFileSync(__dirname + "/static/key.pem");
          const signingCert = fs.readFileSync(__dirname + "/static/cert.pem", "utf-8");
          const signedXml = signXmlResponse(xml, { privateKey: signingKey });

          const base64xml = Buffer.from(signedXml).toString("base64");
          const container = { SAMLResponse: base64xml };
          const samlObj = new SAML({
            cert: signingCert,
            audience: false,
            issuer: "onesaml_login",
            wantAssertionsSigned: false,
          });
          const { profile } = await samlObj.validatePostResponseAsync(container);
          assertRequired(profile, "profile must exist");
          const eptid = profile["urn:oid:1.3.6.1.4.1.5923.1.1.1.10"] as XMLOutput;
          const nameid = eptid["NameID"][0];
          expect(nameid._).to.equal(nameid_opaque_string);
          expect(nameid.$.NameQualifier).to.equal(nameQualifier);
          expect(nameid.$.SPNameQualifier).to.equal(spNameQualifier);
          expect(nameid.$.Format).to.equal(format);
        });

        it("XML AttributeValue without signature should throw", async () => {
          const nameid_opaque_string = "*******************************";
          const nameQualifier = "https://idp.example.org/idp/saml";
          const spNameQualifier = "https://sp.example.org/sp/entity";
          const format = "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent";
          const xml =
            "<Response>" +
            '<saml2:Assertion xmlns:saml2="urn:oasis:names:tc:SAML:2.0:assertion" Version="2.0">' +
            "<saml2:AttributeStatement>" +
            '<saml2:Attribute FriendlyName="eduPersonTargetedID" Name="urn:oid:1.3.6.1.4.1.5923.1.1.1.10" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:uri">' +
            "<saml2:AttributeValue>" +
            '<saml2:NameID Format="' +
            format +
            '" NameQualifier="' +
            nameQualifier +
            '" SPNameQualifier="' +
            spNameQualifier +
            '">' +
            nameid_opaque_string +
            "</saml2:NameID>" +
            "</saml2:AttributeValue>" +
            "</saml2:Attribute>" +
            "</saml2:AttributeStatement>" +
            "</saml2:Assertion>" +
            "</Response>";
          const base64xml = Buffer.from(xml).toString("base64");
          const container = { SAMLResponse: base64xml };
          const samlObj = new SAML({
            cert: TEST_CERT,
            issuer: "onesaml_login",
            wantAuthnResponseSigned: false,
          });
          await assert.rejects(samlObj.validatePostResponseAsync(container), {
            message: "Invalid signature",
          });
        });

        it("An undefined value given with an object should still be undefined", async () => {
          const xml =
            '<Response xmlns="urn:oasis:names:tc:SAML:2.0:protocol" ID="response0">' +
            '<saml2:Assertion xmlns:saml2="urn:oasis:names:tc:SAML:2.0:assertion" Version="2.0">' +
            "<saml2:AttributeStatement>" +
            '<saml2:Attribute Name="attributeName" ' +
            'NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified">' +
            '<saml2:AttributeValue xmlns:xs="http://www.w3.org/2001/XMLSchema" ' +
            'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
            'xsi:type="xs:string"/>' +
            "</saml2:Attribute>" +
            "</saml2:AttributeStatement>" +
            "</saml2:Assertion>" +
            "</Response>";

          const signingKey = fs.readFileSync(__dirname + "/static/key.pem");
          const signingCert = fs.readFileSync(__dirname + "/static/cert.pem", "utf-8");
          const signedXml = signXmlResponse(xml, { privateKey: signingKey });

          const base64xml = Buffer.from(signedXml).toString("base64");
          const container = { SAMLResponse: base64xml };
          const samlObj = new SAML({
            cert: signingCert,
            audience: false,
            issuer: "onesaml_login",
            wantAssertionsSigned: false,
          });
          const { profile } = await samlObj.validatePostResponseAsync(container);
          assertRequired(profile, "profile must exist");
          expect(profile["attributeName"]).to.be.undefined;
        });
      });
    });

    describe("getAuthorizeUrl request signature checks /", function () {
      let fakeClock: sinon.SinonFakeTimers;

      beforeEach(function () {
        fakeClock = sinon.useFakeTimers(Date.parse("2014-05-28T00:13:09Z"));
      });

      afterEach(function () {
        fakeClock.restore();
      });

      it("acme_tools request signed with sha256", async () => {
        const samlConfig: SamlConfig = {
          entryPoint: "https://adfs.acme_tools.com/adfs/ls/",
          issuer: "acme_tools_com",
          callbackUrl: "https://relyingparty/adfs/postResponse",
          privateKey: fs.readFileSync(__dirname + "/static/acme_tools_com.key", "utf-8"),
          authnContext: [
            "http://schemas.microsoft.com/ws/2008/06/identity/authenticationmethod/password",
          ],
          identifierFormat: null,
          signatureAlgorithm: "sha256",
          additionalParams: {
            customQueryStringParam: "CustomQueryStringParamValue",
          },
          cert: FAKE_CERT,
          generateUniqueId: () => "_12345678901234567890",
        };
        const samlObj = new SAML(samlConfig);
        const authorizeUrl = await samlObj.getAuthorizeUrlAsync("", "", {});
        const qry = querystring.parse(new URL(authorizeUrl).searchParams.toString() || "");
        expect(qry.SigAlg).to.equal("http://www.w3.org/2001/04/xmldsig-more#rsa-sha256");
        expect(qry.Signature).to.equal(
          "D161m5GVbOfRHk85GvhmQ48OoFZ6n8mJuddzCe0g1Zlh9cb3b4oMMk5RCsoaOBsA3ndRnCWF3YQb78rO/MRQ+HIxIt0JDrhBoyT7GXPIUvbM/B4cJEgbfFAYouKQIy1sPunlLaTNkRL4tArKK7r4W2WF6R0hydcN8aln8/+TlTUfIengvVuXGLdtW0wSt+1HK1PiwrhLtqFHxxq2XL0X6jBqMEYYjByLfZme3Sk6x6uPIW7zhJn6OXzXlLuH9ILxusexu7GaLpw7C5EUQW43R6vlTGw+bBmx+tC0fqaMLOUWHX/uISAAeWYCAGYA8cbRuqIWh/vnVifxF0CP2sf5Vg=="
        );
        expect(qry.customQueryStringParam).to.equal("CustomQueryStringParamValue");
      });

      it("acme_tools request not signed if missing entry point", async () => {
        const samlConfig: SamlConfig = {
          entryPoint: "",
          issuer: "acme_tools_com",
          callbackUrl: "https://relyingparty/adfs/postResponse",
          privateKey: fs.readFileSync(__dirname + "/static/acme_tools_com.key", "utf-8"),
          authnContext: [
            "http://schemas.microsoft.com/ws/2008/06/identity/authenticationmethod/password",
          ],
          signatureAlgorithm: "sha256",
          additionalParams: {
            customQueryStringParam: "CustomQueryStringParamValue",
          },
          cert: FAKE_CERT,
          generateUniqueId: () => "_12345678901234567890",
        };
        const samlObj = new SAML(samlConfig);

        const request =
          '<?xml version=\\"1.0\\"?><samlp:AuthnRequest xmlns:samlp=\\"urn:oasis:names:tc:SAML:2.0:protocol\\" ID=\\"_ea40a8ab177df048d645\\" Version=\\"2.0\\" IssueInstant=\\"2017-08-22T19:30:01.363Z\\" ProtocolBinding=\\"urn:oasis:names$tc:SAML:2.0:bindings:HTTP-POST\\" AssertionConsumerServiceURL=\\"https://example.com/login/callback\\" Destination=\\"https://www.example.com\\"><saml:Issuer xmlns:saml=\\"urn:oasis:names:tc:SAML:2.0:assertion\\">onelogin_saml</saml:Issuer><s$mlp:NameIDPolicy xmlns:samlp=\\"urn:oasis:names:tc:SAML:2.0:protocol\\" Format=\\"urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress\\" AllowCreate=\\"true\\"/><samlp:RequestedAuthnContext xmlns:samlp=\\"urn:oasis:names:tc:SAML:2.0:protoc$l\\" Comparison=\\"exact\\"><saml:AuthnContextClassRef xmlns:saml=\\"urn:oasis:names:tc:SAML:2.0:assertion\\">urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></samlp:RequestedAuthnContext></samlp$AuthnRequest>';
        await assert.rejects(samlObj._requestToUrlAsync(request, null, "authorize", {}), {
          message: "entryPoint is required",
        });
      });
      it("acme_tools request signed with sha1", async () => {
        const samlConfig: SamlConfig = {
          entryPoint: "https://adfs.acme_tools.com/adfs/ls/",
          issuer: "acme_tools_com",
          callbackUrl: "https://relyingparty/adfs/postResponse",
          privateKey: fs.readFileSync(__dirname + "/static/acme_tools_com.key", "utf-8"),
          authnContext: [
            "http://schemas.microsoft.com/ws/2008/06/identity/authenticationmethod/password",
          ],
          signatureAlgorithm: "sha1",
          additionalParams: {
            customQueryStringParam: "CustomQueryStringParamValue",
          },
          cert: fs.readFileSync(__dirname + "/static/acme_tools_com.cert", "utf-8"),
          generateUniqueId: () => "_12345678901234567890",
        };
        const samlObj = new SAML(samlConfig);
        const authorizeUrl = await samlObj.getAuthorizeUrlAsync("", "", {});
        const qry = querystring.parse(new URL(authorizeUrl).searchParams.toString() || "");
        expect(qry.SigAlg).to.equal("http://www.w3.org/2000/09/xmldsig#rsa-sha1");
        expect(qry.Signature).to.equal(
          "br4UPzZ/Oy/hvG7zMGZ041Lba5WDl/JqwDDf40yxxnYXWLdDY77RD5aE8+YK6BY7BbSkvQSNXFbBXPAITcRhyNCT+3JDfwXLDgOf3xvJOzkWHRO3DUi5IOJ9IdKT/Ted+HC0J9L/4W+VA0n+5v6Lrw83UDib57ICytLvW5jamFQE8pO/Z8fQzOpSbzTwf+Q8u5KYkXeg1+H2u6OJYBFVDYOWxOTuuujW8JccqlCleX9tXDJvx/I0tOkwwnIioh1X2xVHGPy1k1wndpf1eUZtjZ4uUMcwRyxt7YuAnV433DohO3WOm2sNehwOy2AO1DUlbFi6/zbqkRK3TrmD9Q+ZUQ=="
        );
        expect(qry.customQueryStringParam).to.equal("CustomQueryStringParamValue");
      });
      it("acme_tools request signed with sha1 when using privateKey", async () => {
        const samlConfig: SamlConfig = {
          entryPoint: "https://adfs.acme_tools.com/adfs/ls/",
          issuer: "acme_tools_com",
          callbackUrl: "https://relyingparty/adfs/postResponse",
          privateKey: fs.readFileSync(__dirname + "/static/acme_tools_com.key", "utf-8"),
          authnContext: [
            "http://schemas.microsoft.com/ws/2008/06/identity/authenticationmethod/password",
          ],
          identifierFormat: null,
          signatureAlgorithm: "sha1",
          additionalParams: {
            customQueryStringParam: "CustomQueryStringParamValue",
          },
          cert: FAKE_CERT,
          generateUniqueId: () => "_12345678901234567890",
        };
        const samlObj = new SAML(samlConfig);
        const authorizeUrl = await samlObj.getAuthorizeUrlAsync("", "", {});
        const qry = querystring.parse(new URL(authorizeUrl).searchParams.toString() || "");
        expect(qry.SigAlg).to.equal("http://www.w3.org/2000/09/xmldsig#rsa-sha1");
        expect(qry.Signature).to.equal(
          "FL5f9hUYxXaCvr/HJOIKXvDlmWIQilsfcmETqwp8bXCnjEBS44uvEY+FhkYgrFOfaMXkAY+kd8rZ7CkP4SWnPxzhmHqdbBIyAdPpIOOHq7/VTqQXrprijtRBHTxrtOtxi3yOjskRz6ad8igokr9Ut3nlorvelZwtskJP/YsAE3v1CrL/bX3EGbepE3Bq5ehdHaNHxP+dwwhMJ6s5jxKLt5YU+vXohonM8fTBEPzbnQ1+0LK9GL3c6JfqNjjBvdWRXdyReRu+gCHisnrI68vBgCwy4VC9E4tg9JNLggtFkxNbhM8Bgu7eWlyhVLdWKKc1vwaDUOrYOimx6CfTXrAQvg=="
        );
        expect(qry.customQueryStringParam).to.equal("CustomQueryStringParamValue");
      });
    });

    describe("_getAdditionalParams checks /", function () {
      it("should not pass any additional params by default", function () {
        const samlConfig: SamlConfig = {
          entryPoint: "https://app.onelogin.com/trust/saml2/http-post/sso/371755",
          cert: FAKE_CERT,
          issuer: "onesaml_login",
        };
        const samlObj = new SAML(samlConfig);

        (["logout", "authorize"] as const).forEach(function (operation) {
          const additionalParams = samlObj._getAdditionalParams("", operation);
          expect(additionalParams).to.be.empty;
        });
      });

      it("should not pass any additional params by default apart from the RelayState", function () {
        const samlConfig: SamlConfig = {
          entryPoint: "https://app.onelogin.com/trust/saml2/http-post/sso/371755",
          cert: FAKE_CERT,
          issuer: "onesaml_login",
        };
        const samlObj = new SAML(samlConfig);

        (["logout", "authorize"] as const).forEach(function (operation) {
          const additionalParams = samlObj._getAdditionalParams("test", operation);

          expect(Object.keys(additionalParams)).to.have.lengthOf(1);
          expect(additionalParams).to.include({ RelayState: "test" });
        });
      });

      it("should only allow RelayState to be a string", function () {
        const samlConfig: SamlConfig = {
          entryPoint: "https://app.onelogin.com/trust/saml2/http-post/sso/371755",
          cert: FAKE_CERT,
          issuer: "onesaml_login",
        };
        const samlObj = new SAML(samlConfig);

        (["logout", "authorize"] as const).forEach(function (operation) {
          const additionalParams = samlObj._getAdditionalParams(
            { RelayState: "test" } as unknown as string,
            operation
          );

          expect(Object.keys(additionalParams)).to.have.lengthOf(0);
        });
      });

      it("should pass additional params with all operations if set in additionalParams", function () {
        const samlConfig: SamlConfig = {
          entryPoint: "https://app.onelogin.com/trust/saml2/http-post/sso/371755",
          additionalParams: {
            queryParam: "queryParamValue",
          },
          cert: FAKE_CERT,
          issuer: "onesaml_login",
        };
        const samlObj = new SAML(samlConfig);

        (["logout", "authorize"] as const).forEach(function (operation) {
          const additionalParams = samlObj._getAdditionalParams("", operation);
          expect(Object.keys(additionalParams)).to.have.lengthOf(1);
          expect(additionalParams).to.include({ queryParam: "queryParamValue" });
        });
      });

      it('should pass additional params with "authorize" operations if set in additionalAuthorizeParams', function () {
        const samlConfig: SamlConfig = {
          entryPoint: "https://app.onelogin.com/trust/saml2/http-post/sso/371755",
          additionalAuthorizeParams: {
            queryParam: "queryParamValue",
          },
          cert: FAKE_CERT,
          issuer: "onesaml_login",
        };
        const samlObj = new SAML(samlConfig);

        const additionalAuthorizeParams = samlObj._getAdditionalParams("", "authorize");
        expect(Object.keys(additionalAuthorizeParams)).to.have.lengthOf(1);
        expect(additionalAuthorizeParams).to.include({ queryParam: "queryParamValue" });

        const additionalLogoutParams = samlObj._getAdditionalParams("", "logout");
        expect(additionalLogoutParams).to.be.empty;
      });

      it('should pass additional params with "logout" operations if set in additionalLogoutParams', function () {
        const samlConfig: SamlConfig = {
          entryPoint: "https://app.onelogin.com/trust/saml2/http-post/sso/371755",
          additionalLogoutParams: {
            queryParam: "queryParamValue",
          },
          cert: FAKE_CERT,
          issuer: "onesaml_login",
        };
        const samlObj = new SAML(samlConfig);

        const additionalAuthorizeParams = samlObj._getAdditionalParams("", "authorize");
        expect(additionalAuthorizeParams).to.be.empty;

        const additionalLogoutParams = samlObj._getAdditionalParams("", "logout");
        expect(Object.keys(additionalLogoutParams)).to.have.lengthOf(1);
        expect(additionalLogoutParams).to.include({ queryParam: "queryParamValue" });
      });

      it("should merge additionalLogoutParams and additionalAuthorizeParams with additionalParams", function () {
        const samlConfig: SamlConfig = {
          entryPoint: "https://app.onelogin.com/trust/saml2/http-post/sso/371755",
          additionalParams: {
            queryParam1: "queryParamValue",
          },
          additionalAuthorizeParams: {
            queryParam2: "queryParamValueAuthorize",
          },
          additionalLogoutParams: {
            queryParam2: "queryParamValueLogout",
          },
          cert: FAKE_CERT,
          issuer: "onesaml_login",
        };
        const samlObj = new SAML(samlConfig);

        const additionalAuthorizeParams = samlObj._getAdditionalParams("", "authorize");
        expect(Object.keys(additionalAuthorizeParams)).to.have.lengthOf(2);
        expect(additionalAuthorizeParams).to.include({
          queryParam1: "queryParamValue",
          queryParam2: "queryParamValueAuthorize",
        });

        const additionalLogoutParams = samlObj._getAdditionalParams("", "logout");
        expect(Object.keys(additionalLogoutParams)).to.have.lengthOf(2);
        expect(additionalLogoutParams).to.include({
          queryParam1: "queryParamValue",
          queryParam2: "queryParamValueLogout",
        });
      });

      it("should merge run-time params additionalLogoutParams and additionalAuthorizeParams with additionalParams", function () {
        const samlConfig: SamlConfig = {
          entryPoint: "https://app.onelogin.com/trust/saml2/http-post/sso/371755",
          additionalParams: {
            queryParam1: "queryParamValue",
          },
          additionalAuthorizeParams: {
            queryParam2: "queryParamValueAuthorize",
          },
          additionalLogoutParams: {
            queryParam2: "queryParamValueLogout",
          },
          cert: FAKE_CERT,
          issuer: "onesaml_login",
        };
        const samlObj = new SAML(samlConfig);
        const options = {
          additionalParams: {
            queryParam3: "queryParamRuntimeValue",
          },
        };

        const additionalAuthorizeParams = samlObj._getAdditionalParams(
          "",
          "authorize",
          options.additionalParams
        );
        expect(Object.keys(additionalAuthorizeParams)).to.have.lengthOf(3);
        expect(additionalAuthorizeParams).to.include({
          queryParam1: "queryParamValue",
          queryParam2: "queryParamValueAuthorize",
          queryParam3: "queryParamRuntimeValue",
        });

        const additionalLogoutParams = samlObj._getAdditionalParams(
          "",
          "logout",
          options.additionalParams
        );
        expect(Object.keys(additionalLogoutParams)).to.have.lengthOf(3);
        expect(additionalLogoutParams).to.include({
          queryParam1: "queryParamValue",
          queryParam2: "queryParamValueLogout",
          queryParam3: "queryParamRuntimeValue",
        });
      });

      it("should prioritize additionalLogoutParams and additionalAuthorizeParams over additionalParams", function () {
        const samlConfig: SamlConfig = {
          entryPoint: "https://app.onelogin.com/trust/saml2/http-post/sso/371755",
          additionalParams: {
            queryParam: "queryParamValue",
          },
          additionalAuthorizeParams: {
            queryParam: "queryParamValueAuthorize",
          },
          additionalLogoutParams: {
            queryParam: "queryParamValueLogout",
          },
          cert: FAKE_CERT,
          issuer: "onesaml_login",
        };
        const samlObj = new SAML(samlConfig);

        const additionalAuthorizeParams = samlObj._getAdditionalParams("", "authorize");
        expect(Object.keys(additionalAuthorizeParams)).to.have.lengthOf(1);
        expect(additionalAuthorizeParams).to.include({ queryParam: "queryParamValueAuthorize" });

        const additionalLogoutParams = samlObj._getAdditionalParams("", "logout");
        expect(Object.keys(additionalLogoutParams)).to.have.lengthOf(1);
        expect(additionalLogoutParams).to.include({ queryParam: "queryParamValueLogout" });
      });

      it("should prioritize run-time params over all other params", function () {
        const samlConfig: SamlConfig = {
          entryPoint: "https://app.onelogin.com/trust/saml2/http-post/sso/371755",
          additionalParams: {
            queryParam: "queryParamValue",
          },
          additionalAuthorizeParams: {
            queryParam: "queryParamValueAuthorize",
          },
          additionalLogoutParams: {
            queryParam: "queryParamValueLogout",
          },
          cert: FAKE_CERT,
          issuer: "onesaml_login",
        };
        const samlObj = new SAML(samlConfig);
        const options = {
          additionalParams: {
            queryParam: "queryParamRuntimeValue",
          },
        };

        const additionalAuthorizeParams = samlObj._getAdditionalParams(
          "",
          "authorize",
          options.additionalParams
        );
        expect(Object.keys(additionalAuthorizeParams)).to.have.lengthOf(1);
        expect(additionalAuthorizeParams).to.include({ queryParam: "queryParamRuntimeValue" });

        const additionalLogoutParams = samlObj._getAdditionalParams(
          "",
          "logout",
          options.additionalParams
        );
        expect(Object.keys(additionalLogoutParams)).to.have.lengthOf(1);
        expect(additionalLogoutParams).to.include({ queryParam: "queryParamRuntimeValue" });
      });

      it("should check the value of the option `racComparison`", function () {
        assert.throws(
          () => {
            new SAML({
              racComparison: "bad_value" as RacComparision,
              cert: FAKE_CERT,
              issuer: "onesaml_login",
            }).options;
          },
          { message: "racComparison must be one of ['exact', 'minimum', 'maximum', 'better']" }
        );

        const samlObjBadComparisonType = new SAML({
          cert: FAKE_CERT,
          issuer: "onesaml_login",
        });
        expect(samlObjBadComparisonType.options.racComparison).equal(
          "exact",
          "the default value of the option `racComparison` must be exact"
        );

        const validComparisonTypes: RacComparision[] = ["exact", "minimum", "maximum", "better"];
        let samlObjValidComparisonType: SAML;
        validComparisonTypes.forEach(function (racComparison) {
          samlObjValidComparisonType = new SAML({
            racComparison,
            cert: FAKE_CERT,
            issuer: "onesaml_login",
          });
          expect(samlObjValidComparisonType.options.racComparison).to.equal(racComparison);
          expect(samlObjValidComparisonType.options.racComparison).to.equal(racComparison);
        });
      });
    });

    describe("InResponseTo validation checks /", () => {
      let fakeClock: sinon.SinonFakeTimers;

      afterEach(function () {
        if (fakeClock) {
          fakeClock.restore();
        }
      });

      [ValidateInResponseTo.always, ValidateInResponseTo.ifPresent].forEach(
        (validateInResponseTo) => {
          describe(`when validateInResponseTo is set to ${validateInResponseTo} /`, () => {
            it("onelogin xml document with InResponseTo from request should validate", async () => {
              const requestId = "_a6fc46be84e1e3cf3c50";
              const xml =
                '<samlp:Response xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="R689b0733bccca22a137e3654830312332940b1be" Version="2.0" IssueInstant="2014-05-28T00:16:08Z" Destination="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>' +
                '<saml:Assertion xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="2.0" ID="pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa" IssueInstant="2014-05-28T00:16:08Z"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/><ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><ds:Reference URI="#pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa"><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><ds:DigestValue>DCnPTQYBb1hKspbe6fg1U3q8xn4=</ds:DigestValue></ds:Reference></ds:SignedInfo><ds:SignatureValue>e0+aFomA0+JAY0f9tKqzIuqIVSSw7LiFUsneEDKPBWdiTz1sMdgr/2y1e9+rjaS2mRmCi/vSQLY3zTYz0hp6nJNU19+TWoXo9kHQyWT4KkeQL4Xs/gZ/AoKC20iHVKtpPps0IQ0Ml/qRoouSitt6Sf/WDz2LV/pWcH2hx5tv3xSw36hK2NQc7qw7r1mEXnvcjXReYo8rrVf7XHGGxNoRIEICUIi110uvsWemSXf0Z0dyb0FVYOWuSsQMDlzNpheADBifFO4UTfSEhFZvn8kVCGZUIwrbOhZ2d/+YEtgyuTg+qtslgfy4dwd4TvEcfuRzQTazeefprSFyiQckAXOjcw==</ds:SignatureValue><ds:KeyInfo><ds:X509Data><ds:X509Certificate>' +
                TEST_CERT +
                '</ds:X509Certificate></ds:X509Data></ds:KeyInfo></ds:Signature><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">ploer@subspacesw.com</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData NotOnOrAfter="2014-05-28T00:19:08Z" Recipient="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"/></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="2014-05-28T00:13:08Z" NotOnOrAfter="2014-05-28T00:19:08Z"><saml:AudienceRestriction><saml:Audience>{audience}</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AuthnStatement AuthnInstant="2014-05-28T00:16:07Z" SessionNotOnOrAfter="2014-05-29T00:16:08Z" SessionIndex="_30a4af50-c82b-0131-f8b5-782bcb56fcaa"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement></saml:Assertion>' +
                "</samlp:Response>";
              const base64xml = Buffer.from(xml).toString("base64");
              const container = { SAMLResponse: base64xml };

              const samlConfig: SamlConfig = {
                entryPoint: "https://app.onelogin.com/trust/saml2/http-post/sso/371755",
                cert: TEST_CERT,
                validateInResponseTo,
                audience: false,
                issuer: "onesaml_login",
                wantAssertionsSigned: false,
                wantAuthnResponseSigned: false,
              };
              const samlObj = new SAML(samlConfig);

              fakeClock = sinon.useFakeTimers(Date.parse("2014-05-28T00:13:09Z"));

              // Mock the SAML request being passed through Passport-SAML
              await samlObj.cacheProvider.saveAsync(requestId, new Date().toISOString());

              const { profile } = await samlObj.validatePostResponseAsync(container);
              assertRequired(profile, "profile must exist");
              expect(profile.nameID.startsWith("ploer")).to.be.true;
              const value = await samlObj.cacheProvider.getAsync(requestId);
              expect(value).to.not.exist;
            });

            it("xml document with SubjectConfirmation InResponseTo from request should be valid", async () => {
              const requestId = "_dfab47d5d46374cd4b71";
              const xml =
                '<samlp:Response ID="_f6c28a7d-9c82-4ae8-ba14-fc42c85081d3" InResponseTo="_dfab47d5d46374cd4b71" Version="2.0" IssueInstant="2014-06-05T12:07:07.662Z" xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"><saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">Verizon IDP Hub</saml:Issuer><Signature xmlns="http://www.w3.org/2000/09/xmldsig#"><SignedInfo><CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#" /><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1" /><Reference URI="#_f6c28a7d-9c82-4ae8-ba14-fc42c85081d3"><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature" /><Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"><InclusiveNamespaces PrefixList="#default samlp saml ds xs xsi" xmlns="http://www.w3.org/2001/10/xml-exc-c14n#" /></Transform></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1" /><DigestValue>QecaVjMY/2M4VMJsakvX8uh2Mrg=</DigestValue></Reference></SignedInfo><SignatureValue>QTJ//ZHEQRe9/nA5qTkhECZc2u6M1dHzTkujKBedskLSRPL8LRBb4Yftla0zu848sYvLd3SXzEysYu/jrAjaVDevYZIAdyj/3HCw8pS0ZnQDaCgYuAkH4JmYxBfW1Sc9Kr0vbR58ihwWOZd4xHIn/b8xLs8WNsyTHix2etrLGznioLwTOBO3+SgjwSiSP9NUhrlOvolbuu/6xhLi37/L08JaBvOw3o0k4V8xS87SFczhm4f6wvQM5mP6sZAreoNcWZqQM7vIHFjL0/H9vTaLAN8+fQOc81xFtateTKwFQlJMUmdWKZ8L7ns0Uf1xASQjXtSAACbXI+PuVLjz8nnm3g==</SignatureValue><KeyInfo><X509Data><X509Certificate>MIIC7TCCAdmgAwIBAgIQuIdqos+9yKBC4oygbhtdfzAJBgUrDgMCHQUAMBIxEDAOBgNVBAMTB1Rlc3RTVFMwHhcNMTQwNDE2MTIyMTEwWhcNMzkxMjMxMjM1OTU5WjASMRAwDgYDVQQDEwdUZXN0U1RTMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAmhReamVYbeOWwrrAvHPvS9KKBwv4Tj7wOSGDXbNgfjhSvVyXsnpYRcuoJkvE8b9tCjFTbXCfbhnaVrpoXaWFtP1YvUIZvCJGdOOTXltMNDlNIaFmsIsomza8IyOHXe+3xHWVtxO8FG3qnteSkkVIQuAvBqpPfQtxrXCZOlbQZm7q69QIQ64JvLJfRwHN1EywMBVwbJgrV8gBdE3RITI76coSOK13OBTlGtB0kGKLDrF2JW+5mB+WnFR7GlXUj+V0R9WStBomVipJEwr6Q3fU0deKZ5lLw0+qJ0T6APInwN5TIN/AbFCHd51aaf3zEP+tZacQ9fbZqy9XBAtL2pCAJQIDAQABo0cwRTBDBgNVHQEEPDA6gBDECazhZ8Ar+ULXb0YTs5MvoRQwEjEQMA4GA1UEAxMHVGVzdFNUU4IQuIdqos+9yKBC4oygbhtdfzAJBgUrDgMCHQUAA4IBAQAioMSOU9QFw+yhVxGUNK0p/ghVsHnYdeOE3vSRhmFPsetBt8S35sI4QwnQNiuiEYqp++FabiHgePOiqq5oeY6ekJik1qbs7fgwnaQXsxxSucHvc4BU81x24aKy6jeJzxmFxo3mh6y/OI1peCMSH48iUzmhnoSulp0+oAs3gMEFI0ONbgAA/XoAHaVEsrPj10i3gkztoGdpH0DYUe9rABOJxX/3mNF+dCVJG7t7BoSlNAWlSDErKciNNax1nBskFqNWNIKzUKBIb+GVKkIB2QpATMQB6Oe7inUdT9kkZ/Q7oPBATZk+3mFsIoWr8QRFSqvToOhun7EY2/VtuiV1d932</X509Certificate></X509Data></KeyInfo></Signature><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success" /></samlp:Status><saml:Assertion Version="2.0" ID="_ea67f283-0afb-465a-ba78-5abe7b7f8584" IssueInstant="2014-06-05T12:07:07.663Z" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"><saml:Issuer>Verizon IDP Hub</saml:Issuer><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified">UIS/jochen-work</saml:NameID><saml:SubjectConfirmation><saml:SubjectConfirmationData NotBefore="2014-06-05T12:06:07.664Z" NotOnOrAfter="2014-06-05T12:10:07.664Z" InResponseTo="_dfab47d5d46374cd4b71" /></saml:SubjectConfirmation></saml:Subject><saml:AttributeStatement><saml:Attribute Name="vz::identity" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic"><saml:AttributeValue xsi:type="urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">UIS/jochen-work</saml:AttributeValue></saml:Attribute><saml:Attribute Name="vz::subjecttype" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic"><saml:AttributeValue xsi:type="urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">UIS user</saml:AttributeValue></saml:Attribute><saml:Attribute Name="vz::account" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic"><saml:AttributeValue xsi:type="urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">e9aba0c4-ece8-4b44-9526-d24418aa95dc</saml:AttributeValue></saml:Attribute><saml:Attribute Name="vz::org" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic"><saml:AttributeValue xsi:type="urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">testorg</saml:AttributeValue></saml:Attribute><saml:Attribute Name="vz::name" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic"><saml:AttributeValue xsi:type="urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">Test User</saml:AttributeValue></saml:Attribute><saml:Attribute Name="net::ip" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic"><saml:AttributeValue xsi:type="urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">::1</saml:AttributeValue></saml:Attribute></saml:AttributeStatement></saml:Assertion></samlp:Response>';
              const base64xml = Buffer.from(xml).toString("base64");
              const container = { SAMLResponse: base64xml };

              const samlConfig: SamlConfig = {
                entryPoint: "https://app.onelogin.com/trust/saml2/http-post/sso/371755",
                cert: "MIIC7TCCAdmgAwIBAgIQuIdqos+9yKBC4oygbhtdfzAJBgUrDgMCHQUAMBIxEDAOBgNVBAMTB1Rlc3RTVFMwHhcNMTQwNDE2MTIyMTEwWhcNMzkxMjMxMjM1OTU5WjASMRAwDgYDVQQDEwdUZXN0U1RTMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAmhReamVYbeOWwrrAvHPvS9KKBwv4Tj7wOSGDXbNgfjhSvVyXsnpYRcuoJkvE8b9tCjFTbXCfbhnaVrpoXaWFtP1YvUIZvCJGdOOTXltMNDlNIaFmsIsomza8IyOHXe+3xHWVtxO8FG3qnteSkkVIQuAvBqpPfQtxrXCZOlbQZm7q69QIQ64JvLJfRwHN1EywMBVwbJgrV8gBdE3RITI76coSOK13OBTlGtB0kGKLDrF2JW+5mB+WnFR7GlXUj+V0R9WStBomVipJEwr6Q3fU0deKZ5lLw0+qJ0T6APInwN5TIN/AbFCHd51aaf3zEP+tZacQ9fbZqy9XBAtL2pCAJQIDAQABo0cwRTBDBgNVHQEEPDA6gBDECazhZ8Ar+ULXb0YTs5MvoRQwEjEQMA4GA1UEAxMHVGVzdFNUU4IQuIdqos+9yKBC4oygbhtdfzAJBgUrDgMCHQUAA4IBAQAioMSOU9QFw+yhVxGUNK0p/ghVsHnYdeOE3vSRhmFPsetBt8S35sI4QwnQNiuiEYqp++FabiHgePOiqq5oeY6ekJik1qbs7fgwnaQXsxxSucHvc4BU81x24aKy6jeJzxmFxo3mh6y/OI1peCMSH48iUzmhnoSulp0+oAs3gMEFI0ONbgAA/XoAHaVEsrPj10i3gkztoGdpH0DYUe9rABOJxX/3mNF+dCVJG7t7BoSlNAWlSDErKciNNax1nBskFqNWNIKzUKBIb+GVKkIB2QpATMQB6Oe7inUdT9kkZ/Q7oPBATZk+3mFsIoWr8QRFSqvToOhun7EY2/VtuiV1d932",
                validateInResponseTo,
                audience: false,
                issuer: "onesaml_login",
                wantAssertionsSigned: false,
              };
              const samlObj = new SAML(samlConfig);

              fakeClock = sinon.useFakeTimers(Date.parse("2014-06-05T12:07:07.662Z"));

              // Mock the SAML request being passed through Passport-SAML
              await samlObj.cacheProvider.saveAsync(requestId, new Date().toISOString());

              const { profile } = await samlObj.validatePostResponseAsync(container);
              assertRequired(profile, "profile must exist");
              expect(profile.nameID.startsWith("UIS/jochen-work")).to.be.true;
              const value = await samlObj.cacheProvider.getAsync(requestId);
              expect(value).to.not.exist;
            });
          });
        }
      );

      it("onelogin xml document without InResponseTo from request should fail", async () => {
        const xml =
          '<samlp:Response xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="R689b0733bccca22a137e3654830312332940b1be" Version="2.0" IssueInstant="2014-05-28T00:16:08Z" Destination="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>' +
          '<saml:Assertion xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="2.0" ID="pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa" IssueInstant="2014-05-28T00:16:08Z"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/><ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><ds:Reference URI="#pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa"><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><ds:DigestValue>DCnPTQYBb1hKspbe6fg1U3q8xn4=</ds:DigestValue></ds:Reference></ds:SignedInfo><ds:SignatureValue>e0+aFomA0+JAY0f9tKqzIuqIVSSw7LiFUsneEDKPBWdiTz1sMdgr/2y1e9+rjaS2mRmCi/vSQLY3zTYz0hp6nJNU19+TWoXo9kHQyWT4KkeQL4Xs/gZ/AoKC20iHVKtpPps0IQ0Ml/qRoouSitt6Sf/WDz2LV/pWcH2hx5tv3xSw36hK2NQc7qw7r1mEXnvcjXReYo8rrVf7XHGGxNoRIEICUIi110uvsWemSXf0Z0dyb0FVYOWuSsQMDlzNpheADBifFO4UTfSEhFZvn8kVCGZUIwrbOhZ2d/+YEtgyuTg+qtslgfy4dwd4TvEcfuRzQTazeefprSFyiQckAXOjcw==</ds:SignatureValue><ds:KeyInfo><ds:X509Data><ds:X509Certificate>' +
          TEST_CERT +
          '</ds:X509Certificate></ds:X509Data></ds:KeyInfo></ds:Signature><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">ploer@subspacesw.com</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData NotOnOrAfter="2014-05-28T00:19:08Z" Recipient="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"/></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="2014-05-28T00:13:08Z" NotOnOrAfter="2014-05-28T00:19:08Z"><saml:AudienceRestriction><saml:Audience>{audience}</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AuthnStatement AuthnInstant="2014-05-28T00:16:07Z" SessionNotOnOrAfter="2014-05-29T00:16:08Z" SessionIndex="_30a4af50-c82b-0131-f8b5-782bcb56fcaa"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement></saml:Assertion>' +
          "</samlp:Response>";
        const base64xml = Buffer.from(xml).toString("base64");
        const container = { SAMLResponse: base64xml };

        const samlConfig: SamlConfig = {
          entryPoint: "https://app.onelogin.com/trust/saml2/http-post/sso/371755",
          cert: TEST_CERT,
          validateInResponseTo: ValidateInResponseTo.always,
          issuer: "onesaml_login",
        };
        const samlObj = new SAML(samlConfig);

        fakeClock = sinon.useFakeTimers(Date.parse("2014-05-28T00:13:09Z"));
        await assert.rejects(samlObj.validatePostResponseAsync(container), {
          message: "InResponseTo is not valid",
        });
      });

      it("xml document with SubjectConfirmation and missing InResponseTo from request should not be valid", async () => {
        const requestId = "_dfab47d5d46374cd4b71";
        const xml =
          '<samlp:Response ID="_f6c28a7d-9c82-4ae8-ba14-fc42c85081d3" Version="2.0" IssueInstant="2014-06-05T12:07:07.662Z" xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"><saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">Verizon IDP Hub</saml:Issuer><Signature xmlns="http://www.w3.org/2000/09/xmldsig#"><SignedInfo><CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#" /><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1" /><Reference URI="#_f6c28a7d-9c82-4ae8-ba14-fc42c85081d3"><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature" /><Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"><InclusiveNamespaces PrefixList="#default samlp saml ds xs xsi" xmlns="http://www.w3.org/2001/10/xml-exc-c14n#" /></Transform></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1" /><DigestValue>c8xR7YMU8KAYbkV7Jx3WEBhIqso=</DigestValue></Reference></SignedInfo><SignatureValue>jPOrsXdG/YVyGrykXYUbgVK7iX+tNFjMJnOA2iFWOjjtWco9M5DT9tyUsYAag4o4oDUEJribGWhCYn6nvQ24zfW+eJYGwbxO0TSZ26J0iuhnxr+MMFmJVGjxArD70dea0kITssqCxJNKUwmTqteAQ73+qk91H9E9IDoOjMwQERoyD4sAtvfJErRrRontvg9xeQ0BFtyMzJZkwU24QqHvoHyw9/dVO8/NFPydwjaI9uZMu6/QUYKKvkbf6VUXXQUHIiZgX0GCudpB908BqWIcj0dWv8oKGGajQWp+d8Jlx/nxbUTAs8vL1f0dxW3LYCZsDExHmjRQTBhM0pQVMT+HlA==</SignatureValue><KeyInfo><X509Data><X509Certificate>MIICrjCCAZYCCQDWybyUsLVkXzANBgkqhkiG9w0BAQsFADAZMRcwFQYDVQQDFA5hY21lX3Rvb2xzLmNvbTAeFw0xNTA4MTgwODQ3MzZaFw0yNTA4MTcwODQ3MzZaMBkxFzAVBgNVBAMUDmFjbWVfdG9vbHMuY29tMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAlyT+OzEymhaZFNfx4+HFxZbBP3egvcUgPvGa7wWCV7vyuCauLBqwO1FQqzaRDxkEihkHqmUz63D25v2QixLxXyqaFQ8TxDFKwYATtSL7x5G2Gww56H0L1XGgYdNW1akPx90P+USmVn1Wb//7AwU+TV+u4jIgKZyTaIFWdFlwBhlp4OBEHCyYwngFgMyVoCBsSmwb4if7Mi5T746J9ZMQpC+ts+kfzley59Nz55pa5fRLwu4qxFUv2oRdXAf2ZLuxB7DPQbRH82/ewZZ8N4BUGiQyAwOsHgp0sb9JJ8uEM/qhyS1dXXxjo+kxsI5HXhxp4P5R9VADuOquaLIo8ptIrQIDAQABMA0GCSqGSIb3DQEBCwUAA4IBAQBW/Y7leJnV76+6bzeqqi+buTLyWc1mASi5LVH68mdailg2WmGfKlSMLGzFkNtg8fJnfaRZ/GtxmSxhpQRHn63ZlyzqVrFcJa0qzPG21PXPHG/ny8pN+BV8fk74CIb/+YN7NvDUrV7jlsPxNT2rQk8G2fM7jsTMYvtz0MBkrZZsUzTv4rZkF/v44J/ACDirKJiE+TYArm70yQPweX6RvYHNZLSzgg4o+hoyBXo5BGQetAjmcIhC6ZOwN3iVhGjp0YpWM0pkqStPy3sIR0//LZbskWWlSRb0fX1c4632Xb+zikfec4DniYV6CxkB2U+plHpOX1rt1R+UiTEIhTSXPNt/</X509Certificate></X509Data></KeyInfo></Signature><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success" /></samlp:Status><saml:Assertion Version="2.0" ID="_ea67f283-0afb-465a-ba78-5abe7b7f8584" IssueInstant="2014-06-05T12:07:07.663Z" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"><saml:Issuer>Verizon IDP Hub</saml:Issuer><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified">UIS/jochen-work</saml:NameID><saml:SubjectConfirmation><saml:SubjectConfirmationData NotBefore="2014-06-05T12:06:07.664Z" NotOnOrAfter="2014-06-05T12:10:07.664Z" /></saml:SubjectConfirmation></saml:Subject><saml:AttributeStatement><saml:Attribute Name="vz::identity" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic"><saml:AttributeValue xsi:type="urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">UIS/jochen-work</saml:AttributeValue></saml:Attribute><saml:Attribute Name="vz::subjecttype" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic"><saml:AttributeValue xsi:type="urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">UIS user</saml:AttributeValue></saml:Attribute><saml:Attribute Name="vz::account" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic"><saml:AttributeValue xsi:type="urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">e9aba0c4-ece8-4b44-9526-d24418aa95dc</saml:AttributeValue></saml:Attribute><saml:Attribute Name="vz::org" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic"><saml:AttributeValue xsi:type="urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">testorg</saml:AttributeValue></saml:Attribute><saml:Attribute Name="vz::name" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic"><saml:AttributeValue xsi:type="urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">Test User</saml:AttributeValue></saml:Attribute><saml:Attribute Name="net::ip" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic"><saml:AttributeValue xsi:type="urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">::1</saml:AttributeValue></saml:Attribute></saml:AttributeStatement></saml:Assertion></samlp:Response>';
        const base64xml = Buffer.from(xml).toString("base64");
        const container = { SAMLResponse: base64xml };

        const samlConfig: SamlConfig = {
          entryPoint: "https://app.onelogin.com/trust/saml2/http-post/sso/371755",
          cert: "MIICrjCCAZYCCQDWybyUsLVkXzANBgkqhkiG9w0BAQsFADAZMRcwFQYDVQQDFA5hY21lX3Rvb2xzLmNvbTAeFw0xNTA4MTgwODQ3MzZaFw0yNTA4MTcwODQ3MzZaMBkxFzAVBgNVBAMUDmFjbWVfdG9vbHMuY29tMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAlyT+OzEymhaZFNfx4+HFxZbBP3egvcUgPvGa7wWCV7vyuCauLBqwO1FQqzaRDxkEihkHqmUz63D25v2QixLxXyqaFQ8TxDFKwYATtSL7x5G2Gww56H0L1XGgYdNW1akPx90P+USmVn1Wb//7AwU+TV+u4jIgKZyTaIFWdFlwBhlp4OBEHCyYwngFgMyVoCBsSmwb4if7Mi5T746J9ZMQpC+ts+kfzley59Nz55pa5fRLwu4qxFUv2oRdXAf2ZLuxB7DPQbRH82/ewZZ8N4BUGiQyAwOsHgp0sb9JJ8uEM/qhyS1dXXxjo+kxsI5HXhxp4P5R9VADuOquaLIo8ptIrQIDAQABMA0GCSqGSIb3DQEBCwUAA4IBAQBW/Y7leJnV76+6bzeqqi+buTLyWc1mASi5LVH68mdailg2WmGfKlSMLGzFkNtg8fJnfaRZ/GtxmSxhpQRHn63ZlyzqVrFcJa0qzPG21PXPHG/ny8pN+BV8fk74CIb/+YN7NvDUrV7jlsPxNT2rQk8G2fM7jsTMYvtz0MBkrZZsUzTv4rZkF/v44J/ACDirKJiE+TYArm70yQPweX6RvYHNZLSzgg4o+hoyBXo5BGQetAjmcIhC6ZOwN3iVhGjp0YpWM0pkqStPy3sIR0//LZbskWWlSRb0fX1c4632Xb+zikfec4DniYV6CxkB2U+plHpOX1rt1R+UiTEIhTSXPNt/",
          validateInResponseTo: ValidateInResponseTo.always,
          issuer: "onesaml_login",
        };
        const samlObj = new SAML(samlConfig);

        fakeClock = sinon.useFakeTimers(Date.parse("2014-06-05T12:07:07.662Z"));

        // Mock the SAML request being passed through Passport-SAML
        await samlObj.cacheProvider.saveAsync(requestId, new Date().toISOString());

        try {
          const { profile } = await samlObj.validatePostResponseAsync(container);
          expect(profile).to.not.exist;
        } catch (err: unknown) {
          expect(err).to.be.instanceOf(Error);
          expect((err as Error).message).to.eq("InResponseTo is missing from response");
        }
      });

      [ValidateInResponseTo.ifPresent, ValidateInResponseTo.never].forEach(
        (validateInResponseTo) => {
          describe(`when validateInResponseTo is set to ${validateInResponseTo}`, () => {
            it("onelogin xml document without InResponseTo should validate", async () => {
              const requestId = "_a6fc46be84e1e3cf3c50";
              const xml =
                '<samlp:Response xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="R689b0733bccca22a137e3654830312332940b1be" Version="2.0" IssueInstant="2014-05-28T00:16:08Z" Destination="{recipient}"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>' +
                '<saml:Assertion xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="2.0" ID="pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa" IssueInstant="2014-05-28T00:16:08Z"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/><ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><ds:Reference URI="#pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa"><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><ds:DigestValue>DCnPTQYBb1hKspbe6fg1U3q8xn4=</ds:DigestValue></ds:Reference></ds:SignedInfo><ds:SignatureValue>e0+aFomA0+JAY0f9tKqzIuqIVSSw7LiFUsneEDKPBWdiTz1sMdgr/2y1e9+rjaS2mRmCi/vSQLY3zTYz0hp6nJNU19+TWoXo9kHQyWT4KkeQL4Xs/gZ/AoKC20iHVKtpPps0IQ0Ml/qRoouSitt6Sf/WDz2LV/pWcH2hx5tv3xSw36hK2NQc7qw7r1mEXnvcjXReYo8rrVf7XHGGxNoRIEICUIi110uvsWemSXf0Z0dyb0FVYOWuSsQMDlzNpheADBifFO4UTfSEhFZvn8kVCGZUIwrbOhZ2d/+YEtgyuTg+qtslgfy4dwd4TvEcfuRzQTazeefprSFyiQckAXOjcw==</ds:SignatureValue><ds:KeyInfo><ds:X509Data><ds:X509Certificate>' +
                TEST_CERT +
                '</ds:X509Certificate></ds:X509Data></ds:KeyInfo></ds:Signature><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">ploer@subspacesw.com</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData NotOnOrAfter="2014-05-28T00:19:08Z" Recipient="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"/></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="2014-05-28T00:13:08Z" NotOnOrAfter="2014-05-28T00:19:08Z"><saml:AudienceRestriction><saml:Audience>{audience}</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AuthnStatement AuthnInstant="2014-05-28T00:16:07Z" SessionNotOnOrAfter="2014-05-29T00:16:08Z" SessionIndex="_30a4af50-c82b-0131-f8b5-782bcb56fcaa"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement></saml:Assertion>' +
                "</samlp:Response>";
              const base64xml = Buffer.from(xml).toString("base64");
              const container = { SAMLResponse: base64xml };

              const samlConfig: SamlConfig = {
                entryPoint: "https://app.onelogin.com/trust/saml2/http-post/sso/371755",
                cert: TEST_CERT,
                validateInResponseTo,
                audience: false,
                issuer: "onesaml_login",
                wantAssertionsSigned: false,
                wantAuthnResponseSigned: false,
              };
              const samlObj = new SAML(samlConfig);

              fakeClock = sinon.useFakeTimers(Date.parse("2014-05-28T00:13:09Z"));
              const { profile } = await samlObj.validatePostResponseAsync(container);
              assertRequired(profile, "profile must exist");
              expect(profile.nameID.startsWith("ploer")).to.be.true;
              const value = await samlObj.cacheProvider.getAsync(requestId);
              expect(value).to.not.exist;
            });

            it("xml document with SubjectConfirmation and missing InResponseTo from request should be not problematic if not validated", async () => {
              const requestId = "_dfab47d5d46374cd4b71";
              const xml =
                '<samlp:Response ID="_f6c28a7d-9c82-4ae8-ba14-fc42c85081d3" Version="2.0" IssueInstant="2014-06-05T12:07:07.662Z" xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"><saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">Verizon IDP Hub</saml:Issuer><Signature xmlns="http://www.w3.org/2000/09/xmldsig#"><SignedInfo><CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#" /><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1" /><Reference URI="#_f6c28a7d-9c82-4ae8-ba14-fc42c85081d3"><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature" /><Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"><InclusiveNamespaces PrefixList="#default samlp saml ds xs xsi" xmlns="http://www.w3.org/2001/10/xml-exc-c14n#" /></Transform></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1" /><DigestValue>c8xR7YMU8KAYbkV7Jx3WEBhIqso=</DigestValue></Reference></SignedInfo><SignatureValue>jPOrsXdG/YVyGrykXYUbgVK7iX+tNFjMJnOA2iFWOjjtWco9M5DT9tyUsYAag4o4oDUEJribGWhCYn6nvQ24zfW+eJYGwbxO0TSZ26J0iuhnxr+MMFmJVGjxArD70dea0kITssqCxJNKUwmTqteAQ73+qk91H9E9IDoOjMwQERoyD4sAtvfJErRrRontvg9xeQ0BFtyMzJZkwU24QqHvoHyw9/dVO8/NFPydwjaI9uZMu6/QUYKKvkbf6VUXXQUHIiZgX0GCudpB908BqWIcj0dWv8oKGGajQWp+d8Jlx/nxbUTAs8vL1f0dxW3LYCZsDExHmjRQTBhM0pQVMT+HlA==</SignatureValue><KeyInfo><X509Data><X509Certificate>MIICrjCCAZYCCQDWybyUsLVkXzANBgkqhkiG9w0BAQsFADAZMRcwFQYDVQQDFA5hY21lX3Rvb2xzLmNvbTAeFw0xNTA4MTgwODQ3MzZaFw0yNTA4MTcwODQ3MzZaMBkxFzAVBgNVBAMUDmFjbWVfdG9vbHMuY29tMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAlyT+OzEymhaZFNfx4+HFxZbBP3egvcUgPvGa7wWCV7vyuCauLBqwO1FQqzaRDxkEihkHqmUz63D25v2QixLxXyqaFQ8TxDFKwYATtSL7x5G2Gww56H0L1XGgYdNW1akPx90P+USmVn1Wb//7AwU+TV+u4jIgKZyTaIFWdFlwBhlp4OBEHCyYwngFgMyVoCBsSmwb4if7Mi5T746J9ZMQpC+ts+kfzley59Nz55pa5fRLwu4qxFUv2oRdXAf2ZLuxB7DPQbRH82/ewZZ8N4BUGiQyAwOsHgp0sb9JJ8uEM/qhyS1dXXxjo+kxsI5HXhxp4P5R9VADuOquaLIo8ptIrQIDAQABMA0GCSqGSIb3DQEBCwUAA4IBAQBW/Y7leJnV76+6bzeqqi+buTLyWc1mASi5LVH68mdailg2WmGfKlSMLGzFkNtg8fJnfaRZ/GtxmSxhpQRHn63ZlyzqVrFcJa0qzPG21PXPHG/ny8pN+BV8fk74CIb/+YN7NvDUrV7jlsPxNT2rQk8G2fM7jsTMYvtz0MBkrZZsUzTv4rZkF/v44J/ACDirKJiE+TYArm70yQPweX6RvYHNZLSzgg4o+hoyBXo5BGQetAjmcIhC6ZOwN3iVhGjp0YpWM0pkqStPy3sIR0//LZbskWWlSRb0fX1c4632Xb+zikfec4DniYV6CxkB2U+plHpOX1rt1R+UiTEIhTSXPNt/</X509Certificate></X509Data></KeyInfo></Signature><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success" /></samlp:Status><saml:Assertion Version="2.0" ID="_ea67f283-0afb-465a-ba78-5abe7b7f8584" IssueInstant="2014-06-05T12:07:07.663Z" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"><saml:Issuer>Verizon IDP Hub</saml:Issuer><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified">UIS/jochen-work</saml:NameID><saml:SubjectConfirmation><saml:SubjectConfirmationData NotBefore="2014-06-05T12:06:07.664Z" NotOnOrAfter="2014-06-05T12:10:07.664Z" /></saml:SubjectConfirmation></saml:Subject><saml:AttributeStatement><saml:Attribute Name="vz::identity" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic"><saml:AttributeValue xsi:type="urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">UIS/jochen-work</saml:AttributeValue></saml:Attribute><saml:Attribute Name="vz::subjecttype" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic"><saml:AttributeValue xsi:type="urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">UIS user</saml:AttributeValue></saml:Attribute><saml:Attribute Name="vz::account" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic"><saml:AttributeValue xsi:type="urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">e9aba0c4-ece8-4b44-9526-d24418aa95dc</saml:AttributeValue></saml:Attribute><saml:Attribute Name="vz::org" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic"><saml:AttributeValue xsi:type="urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">testorg</saml:AttributeValue></saml:Attribute><saml:Attribute Name="vz::name" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic"><saml:AttributeValue xsi:type="urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">Test User</saml:AttributeValue></saml:Attribute><saml:Attribute Name="net::ip" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic"><saml:AttributeValue xsi:type="urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">::1</saml:AttributeValue></saml:Attribute></saml:AttributeStatement></saml:Assertion></samlp:Response>';
              const base64xml = Buffer.from(xml).toString("base64");
              const container = { SAMLResponse: base64xml };

              const samlConfig: SamlConfig = {
                entryPoint: "https://app.onelogin.com/trust/saml2/http-post/sso/371755",
                cert: "MIICrjCCAZYCCQDWybyUsLVkXzANBgkqhkiG9w0BAQsFADAZMRcwFQYDVQQDFA5hY21lX3Rvb2xzLmNvbTAeFw0xNTA4MTgwODQ3MzZaFw0yNTA4MTcwODQ3MzZaMBkxFzAVBgNVBAMUDmFjbWVfdG9vbHMuY29tMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAlyT+OzEymhaZFNfx4+HFxZbBP3egvcUgPvGa7wWCV7vyuCauLBqwO1FQqzaRDxkEihkHqmUz63D25v2QixLxXyqaFQ8TxDFKwYATtSL7x5G2Gww56H0L1XGgYdNW1akPx90P+USmVn1Wb//7AwU+TV+u4jIgKZyTaIFWdFlwBhlp4OBEHCyYwngFgMyVoCBsSmwb4if7Mi5T746J9ZMQpC+ts+kfzley59Nz55pa5fRLwu4qxFUv2oRdXAf2ZLuxB7DPQbRH82/ewZZ8N4BUGiQyAwOsHgp0sb9JJ8uEM/qhyS1dXXxjo+kxsI5HXhxp4P5R9VADuOquaLIo8ptIrQIDAQABMA0GCSqGSIb3DQEBCwUAA4IBAQBW/Y7leJnV76+6bzeqqi+buTLyWc1mASi5LVH68mdailg2WmGfKlSMLGzFkNtg8fJnfaRZ/GtxmSxhpQRHn63ZlyzqVrFcJa0qzPG21PXPHG/ny8pN+BV8fk74CIb/+YN7NvDUrV7jlsPxNT2rQk8G2fM7jsTMYvtz0MBkrZZsUzTv4rZkF/v44J/ACDirKJiE+TYArm70yQPweX6RvYHNZLSzgg4o+hoyBXo5BGQetAjmcIhC6ZOwN3iVhGjp0YpWM0pkqStPy3sIR0//LZbskWWlSRb0fX1c4632Xb+zikfec4DniYV6CxkB2U+plHpOX1rt1R+UiTEIhTSXPNt/",
                validateInResponseTo,
                audience: false,
                issuer: "onesaml_login",
                wantAssertionsSigned: false,
              };
              const samlObj = new SAML(samlConfig);

              fakeClock = sinon.useFakeTimers(Date.parse("2014-06-05T12:07:07.662Z"));

              // Mock the SAML request being passed through Passport-SAML
              await samlObj.cacheProvider.saveAsync(requestId, new Date().toISOString());

              const { profile } = await samlObj.validatePostResponseAsync(container);
              assertRequired(profile, "profile must exist");
              expect(profile.nameID.startsWith("UIS/jochen-work")).to.be.true;
              const value = await samlObj.cacheProvider.getAsync(requestId);
              expect(value).to.exist;
              expect(value).to.eql("2014-06-05T12:07:07.662Z");
            });
          });
        }
      );

      it("onelogin xml document with InResponseTo not in the cache should validate", async () => {
        const requestId = "_a6fc46be84e1e3cf3c50";
        const xml =
          '<samlp:Response xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="R689b0733bccca22a137e3654830312332940b1be" Version="2.0" IssueInstant="2014-05-28T00:16:08Z" Destination="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>' +
          '<saml:Assertion xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="2.0" ID="pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa" IssueInstant="2014-05-28T00:16:08Z"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/><ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><ds:Reference URI="#pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa"><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><ds:DigestValue>DCnPTQYBb1hKspbe6fg1U3q8xn4=</ds:DigestValue></ds:Reference></ds:SignedInfo><ds:SignatureValue>e0+aFomA0+JAY0f9tKqzIuqIVSSw7LiFUsneEDKPBWdiTz1sMdgr/2y1e9+rjaS2mRmCi/vSQLY3zTYz0hp6nJNU19+TWoXo9kHQyWT4KkeQL4Xs/gZ/AoKC20iHVKtpPps0IQ0Ml/qRoouSitt6Sf/WDz2LV/pWcH2hx5tv3xSw36hK2NQc7qw7r1mEXnvcjXReYo8rrVf7XHGGxNoRIEICUIi110uvsWemSXf0Z0dyb0FVYOWuSsQMDlzNpheADBifFO4UTfSEhFZvn8kVCGZUIwrbOhZ2d/+YEtgyuTg+qtslgfy4dwd4TvEcfuRzQTazeefprSFyiQckAXOjcw==</ds:SignatureValue><ds:KeyInfo><ds:X509Data><ds:X509Certificate>' +
          TEST_CERT +
          '</ds:X509Certificate></ds:X509Data></ds:KeyInfo></ds:Signature><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">ploer@subspacesw.com</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData NotOnOrAfter="2014-05-28T00:19:08Z" Recipient="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"/></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="2014-05-28T00:13:08Z" NotOnOrAfter="2014-05-28T00:19:08Z"><saml:AudienceRestriction><saml:Audience>{audience}</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AuthnStatement AuthnInstant="2014-05-28T00:16:07Z" SessionNotOnOrAfter="2014-05-29T00:16:08Z" SessionIndex="_30a4af50-c82b-0131-f8b5-782bcb56fcaa"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement></saml:Assertion>' +
          "</samlp:Response>";
        const base64xml = Buffer.from(xml).toString("base64");
        const container = { SAMLResponse: base64xml };

        const samlConfig: SamlConfig = {
          entryPoint: "https://app.onelogin.com/trust/saml2/http-post/sso/371755",
          cert: TEST_CERT,
          validateInResponseTo: ValidateInResponseTo.never,
          audience: false,
          issuer: "onesaml_login",
          wantAuthnResponseSigned: false,
        };
        const samlObj = new SAML(samlConfig);

        fakeClock = sinon.useFakeTimers(Date.parse("2014-05-28T00:13:09Z"));
        const { profile } = await samlObj.validatePostResponseAsync(container);
        assertRequired(profile, "profile must exist");
        expect(profile.nameID.startsWith("ploer")).to.be.true;
        const value = await samlObj.cacheProvider.getAsync(requestId);
        expect(value).not.to.exist;
      });

      it("xml document with multiple AttributeStatements should have all attributes present on profile", async () => {
        const requestId = "_dfab47d5d46374cd4b71";
        const xml =
          '<samlp:Response ID="_f6c28a7d-9c82-4ae8-ba14-fc42c85081d3" InResponseTo="_dfab47d5d46374cd4b71" Version="2.0" IssueInstant="2014-06-05T12:07:07.662Z" xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"><saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">Verizon IDP Hub</saml:Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status><saml:Assertion Version="2.0" ID="_ea67f283-0afb-465a-ba78-5abe7b7f8584" IssueInstant="2014-06-05T12:07:07.663Z" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"><saml:Issuer>Verizon IDP Hub</saml:Issuer><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified">UIS/jochen-work</saml:NameID><saml:SubjectConfirmation><saml:SubjectConfirmationData NotBefore="2014-06-05T12:06:07.664Z" NotOnOrAfter="2014-06-05T12:10:07.664Z" InResponseTo="_dfab47d5d46374cd4b71"/></saml:SubjectConfirmation></saml:Subject><saml:AttributeStatement><saml:Attribute Name="vz::identity" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic"><saml:AttributeValue xsi:type="urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">UIS/jochen-work</saml:AttributeValue></saml:Attribute></saml:AttributeStatement><saml:AttributeStatement><saml:Attribute Name="vz::subjecttype" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic"><saml:AttributeValue xsi:type="urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">UIS user</saml:AttributeValue></saml:Attribute></saml:AttributeStatement><saml:AttributeStatement><saml:Attribute Name="vz::account" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic"><saml:AttributeValue xsi:type="urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">e9aba0c4-ece8-4b44-9526-d24418aa95dc</saml:AttributeValue></saml:Attribute></saml:AttributeStatement><saml:AttributeStatement><saml:Attribute Name="vz::org" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic"><saml:AttributeValue xsi:type="urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">testorg</saml:AttributeValue></saml:Attribute></saml:AttributeStatement><saml:AttributeStatement><saml:Attribute Name="vz::name" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic"><saml:AttributeValue xsi:type="urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">Test User</saml:AttributeValue></saml:Attribute></saml:AttributeStatement><saml:AttributeStatement><saml:Attribute Name="net::ip" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic"><saml:AttributeValue xsi:type="urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">::1</saml:AttributeValue></saml:Attribute></saml:AttributeStatement></saml:Assertion><Signature xmlns="http://www.w3.org/2000/09/xmldsig#"><SignedInfo><CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><Reference URI="#_f6c28a7d-9c82-4ae8-ba14-fc42c85081d3"><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><DigestValue>qD+sVCaEdy1dTJoUQdo6o+tYsuU=</DigestValue></Reference></SignedInfo><SignatureValue>aLl+1yT7zdT4WnRXKh9cx7WWZnUi/NoxMJWhXP5d+Zu9A4/fjKApSywimU0MTTQxYpvZLjOZPsSwmvc1boJOlXveDsL7A3YWi/f7/zqlVWOfXLE8TVLqUE4jtLsJHFWIJXmh8CI0loqQNf6QcYi9BwCK82FhhXC+qWA5WCZIIWUUMxjxnPbunQ7mninEeW568wqyhb9pLV8QkThzZrZINCqxNvWyGuK/XGPx7ciD6ywbBkdOjlDbwRMaKQ9YeCzZGGzJwOe/NuCXj+oUyzfmzUCobIIR0HYLc4B5UplL7XIKQzpOA2lDDsLe6ZzdTv1qjxSm+dlVfo24onmiPlQUgA==</SignatureValue></Signature></samlp:Response>';
        const base64xml = Buffer.from(xml).toString("base64");
        const container = { SAMLResponse: base64xml };

        const samlConfig: SamlConfig = {
          entryPoint: "https://app.onelogin.com/trust/saml2/http-post/sso/371755",
          cert: "MIIDtTCCAp2gAwIBAgIJAKg4VeVcIDz1MA0GCSqGSIb3DQEBBQUAMEUxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpTb21lLVN0YXRlMSEwHwYDVQQKExhJbnRlcm5ldCBXaWRnaXRzIFB0eSBMdGQwHhcNMTUwODEzMDE1NDIwWhcNMTUwOTEyMDE1NDIwWjBFMQswCQYDVQQGEwJVUzETMBEGA1UECBMKU29tZS1TdGF0ZTEhMB8GA1UEChMYSW50ZXJuZXQgV2lkZ2l0cyBQdHkgTHRkMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxG3ouM7U+fXbJt69X1H6d4UNg/uRr06pFuU9RkfIwNC+yaXyptqB3ynXKsL7BFt4DCd0fflRvJAx3feJIDp16wN9GDVHcufWMYPhh2j5HcTW/j9JoIJzGhJyvO00YKBt+hHy83iN1SdChKv5y0iSyiPP5GnqFw+ayyHoM6hSO0PqBou1Xb0ZSIE+DHosBnvVna5w2AiPY4xrJl9yZHZ4Q7DfMiYTgstjETio4bX+6oLiBnYktn7DjdEslqhffVme4PuBxNojI+uCeg/sn4QVLd/iogMJfDWNuLD8326Mi/FE9cCRvFlvAiMSaebMI3zPaySsxTK7Zgj5TpEbmbHI9wIDAQABo4GnMIGkMB0GA1UdDgQWBBSVGgvoW4MhMuzBGce29PY8vSzHFzB1BgNVHSMEbjBsgBSVGgvoW4MhMuzBGce29PY8vSzHF6FJpEcwRTELMAkGA1UEBhMCVVMxEzARBgNVBAgTClNvbWUtU3RhdGUxITAfBgNVBAoTGEludGVybmV0IFdpZGdpdHMgUHR5IEx0ZIIJAKg4VeVcIDz1MAwGA1UdEwQFMAMBAf8wDQYJKoZIhvcNAQEFBQADggEBAJu1rqs+anD74dbdwgd3CnqnQsQDJiEXmBhG2leaGt3ve9b/9gKaJg2pyb2NyppDe1uLqh6nNXDuzg1oNZrPz5pJL/eCXPl7FhxhMUi04TtLf8LeNTCIWYZiFuO4pmhohHcv8kRvYR1+6SkLTC8j/TZerm7qvesSiTQFNapa1eNdVQ8nFwVkEtWl+JzKEM1BlRcn42sjJkijeFp7DpI7pU+PnYeiaXpRv5pJo8ogM1iFxN+SnfEs0EuQ7fhKIG9aHKi7bKZ7L6SyX7MDIGLeulEU6lf5D9BfXNmcMambiS0pXhL2QXajt96UBq8FT2KNXY8XNtR4y6MyyCzhaiZZcc8=",
          validateInResponseTo: ValidateInResponseTo.always,
          audience: false,
          issuer: "onesaml_login",
          wantAssertionsSigned: false,
        };
        const samlObj = new SAML(samlConfig);

        fakeClock = sinon.useFakeTimers(Date.parse("2014-06-05T12:07:07.662Z"));

        // Mock the SAML request being passed through Passport-SAML
        await samlObj.cacheProvider.saveAsync(requestId, new Date().toISOString());

        const { profile } = await samlObj.validatePostResponseAsync(container);
        assertRequired(profile, "profile must exist");
        expect(profile.nameID.startsWith("UIS/jochen-work")).to.be.true;
        expect(profile["vz::identity"] as string).to.equal("UIS/jochen-work");
        expect(profile["vz::subjecttype"] as string).to.equal("UIS user");
        expect(profile["vz::account"] as string).to.equal("e9aba0c4-ece8-4b44-9526-d24418aa95dc");
        expect(profile["vz::org"] as string).to.equal("testorg");
        expect(profile["vz::name"] as string).to.equal("Test User");
        expect(profile["net::ip"] as string).to.equal("::1");
        const value = await samlObj.cacheProvider.getAsync(requestId);
        expect(value).to.not.exist;
      });
    });

    describe("assertion condition checks /", function () {
      const samlConfig: SamlConfig = {
        entryPoint: "https://app.onelogin.com/trust/saml2/http-post/sso/371755",
        cert: TEST_CERT,
        audience: false,
        issuer: "onesaml_login",
        wantAssertionsSigned: false,
        wantAuthnResponseSigned: false,
      };
      let fakeClock: sinon.SinonFakeTimers;

      beforeEach(function () {
        fakeClock = sinon.useFakeTimers(Date.parse("2014-05-28T00:13:09Z"));
      });

      afterEach(function () {
        fakeClock.restore();
      });

      it("onelogin xml document with current time after NotBefore time should validate", async () => {
        const xml =
          '<samlp:Response xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="R689b0733bccca22a137e3654830312332940b1be" Version="2.0" IssueInstant="2014-05-28T00:16:08Z" Destination="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>' +
          '<saml:Assertion xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="2.0" ID="pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa" IssueInstant="2014-05-28T00:16:08Z"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/><ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><ds:Reference URI="#pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa"><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><ds:DigestValue>DCnPTQYBb1hKspbe6fg1U3q8xn4=</ds:DigestValue></ds:Reference></ds:SignedInfo><ds:SignatureValue>e0+aFomA0+JAY0f9tKqzIuqIVSSw7LiFUsneEDKPBWdiTz1sMdgr/2y1e9+rjaS2mRmCi/vSQLY3zTYz0hp6nJNU19+TWoXo9kHQyWT4KkeQL4Xs/gZ/AoKC20iHVKtpPps0IQ0Ml/qRoouSitt6Sf/WDz2LV/pWcH2hx5tv3xSw36hK2NQc7qw7r1mEXnvcjXReYo8rrVf7XHGGxNoRIEICUIi110uvsWemSXf0Z0dyb0FVYOWuSsQMDlzNpheADBifFO4UTfSEhFZvn8kVCGZUIwrbOhZ2d/+YEtgyuTg+qtslgfy4dwd4TvEcfuRzQTazeefprSFyiQckAXOjcw==</ds:SignatureValue><ds:KeyInfo><ds:X509Data><ds:X509Certificate>' +
          TEST_CERT +
          '</ds:X509Certificate></ds:X509Data></ds:KeyInfo></ds:Signature><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">ploer@subspacesw.com</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData NotOnOrAfter="2014-05-28T00:19:08Z" Recipient="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"/></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="2014-05-28T00:13:08Z" NotOnOrAfter="2014-05-28T00:19:08Z"><saml:AudienceRestriction><saml:Audience>{audience}</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AuthnStatement AuthnInstant="2014-05-28T00:16:07Z" SessionNotOnOrAfter="2014-05-29T00:16:08Z" SessionIndex="_30a4af50-c82b-0131-f8b5-782bcb56fcaa"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement></saml:Assertion>' +
          "</samlp:Response>";
        const base64xml = Buffer.from(xml).toString("base64");
        const container = { SAMLResponse: base64xml };
        const samlObj = new SAML(samlConfig);

        // Fake the current date to be within the valid time range
        fakeClock.restore();
        fakeClock = sinon.useFakeTimers(Date.parse("2014-05-28T00:13:09Z"));

        const { profile } = await samlObj.validatePostResponseAsync(container);
        assertRequired(profile, "profile must exist");
        expect(profile.nameID.startsWith("ploer")).to.be.true;
      });

      it("onelogin xml document with current time equal to NotBefore (plus default clock skew)  time should validate", async () => {
        const xml =
          '<samlp:Response xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="R689b0733bccca22a137e3654830312332940b1be" Version="2.0" IssueInstant="2014-05-28T00:16:08Z" Destination="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>' +
          '<saml:Assertion xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="2.0" ID="pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa" IssueInstant="2014-05-28T00:16:08Z"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/><ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><ds:Reference URI="#pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa"><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><ds:DigestValue>DCnPTQYBb1hKspbe6fg1U3q8xn4=</ds:DigestValue></ds:Reference></ds:SignedInfo><ds:SignatureValue>e0+aFomA0+JAY0f9tKqzIuqIVSSw7LiFUsneEDKPBWdiTz1sMdgr/2y1e9+rjaS2mRmCi/vSQLY3zTYz0hp6nJNU19+TWoXo9kHQyWT4KkeQL4Xs/gZ/AoKC20iHVKtpPps0IQ0Ml/qRoouSitt6Sf/WDz2LV/pWcH2hx5tv3xSw36hK2NQc7qw7r1mEXnvcjXReYo8rrVf7XHGGxNoRIEICUIi110uvsWemSXf0Z0dyb0FVYOWuSsQMDlzNpheADBifFO4UTfSEhFZvn8kVCGZUIwrbOhZ2d/+YEtgyuTg+qtslgfy4dwd4TvEcfuRzQTazeefprSFyiQckAXOjcw==</ds:SignatureValue><ds:KeyInfo><ds:X509Data><ds:X509Certificate>' +
          TEST_CERT +
          '</ds:X509Certificate></ds:X509Data></ds:KeyInfo></ds:Signature><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">ploer@subspacesw.com</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData NotOnOrAfter="2014-05-28T00:19:08Z" Recipient="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"/></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="2014-05-28T00:13:08Z" NotOnOrAfter="2014-05-28T00:19:08Z"><saml:AudienceRestriction><saml:Audience>{audience}</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AuthnStatement AuthnInstant="2014-05-28T00:16:07Z" SessionNotOnOrAfter="2014-05-29T00:16:08Z" SessionIndex="_30a4af50-c82b-0131-f8b5-782bcb56fcaa"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement></saml:Assertion>' +
          "</samlp:Response>";
        const base64xml = Buffer.from(xml).toString("base64");
        const container = { SAMLResponse: base64xml };
        const samlObj = new SAML(samlConfig);

        // Fake the current date to be within the valid time range
        fakeClock.restore();
        fakeClock = sinon.useFakeTimers(Date.parse("2014-05-28T00:13:08Z"));

        const { profile } = await samlObj.validatePostResponseAsync(container);
        assertRequired(profile, "profile must exist");
        expect(profile.nameID.startsWith("ploer")).to.be.true;
      });

      it("onelogin xml document with current time before NotBefore time should fail", async () => {
        const xml =
          '<samlp:Response xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="R689b0733bccca22a137e3654830312332940b1be" Version="2.0" IssueInstant="2014-05-28T00:16:08Z" Destination="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>' +
          '<saml:Assertion xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="2.0" ID="pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa" IssueInstant="2014-05-28T00:16:08Z"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/><ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><ds:Reference URI="#pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa"><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><ds:DigestValue>DCnPTQYBb1hKspbe6fg1U3q8xn4=</ds:DigestValue></ds:Reference></ds:SignedInfo><ds:SignatureValue>e0+aFomA0+JAY0f9tKqzIuqIVSSw7LiFUsneEDKPBWdiTz1sMdgr/2y1e9+rjaS2mRmCi/vSQLY3zTYz0hp6nJNU19+TWoXo9kHQyWT4KkeQL4Xs/gZ/AoKC20iHVKtpPps0IQ0Ml/qRoouSitt6Sf/WDz2LV/pWcH2hx5tv3xSw36hK2NQc7qw7r1mEXnvcjXReYo8rrVf7XHGGxNoRIEICUIi110uvsWemSXf0Z0dyb0FVYOWuSsQMDlzNpheADBifFO4UTfSEhFZvn8kVCGZUIwrbOhZ2d/+YEtgyuTg+qtslgfy4dwd4TvEcfuRzQTazeefprSFyiQckAXOjcw==</ds:SignatureValue><ds:KeyInfo><ds:X509Data><ds:X509Certificate>' +
          TEST_CERT +
          '</ds:X509Certificate></ds:X509Data></ds:KeyInfo></ds:Signature><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">ploer@subspacesw.com</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData NotOnOrAfter="2014-05-28T00:19:08Z" Recipient="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"/></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="2014-05-28T00:13:08Z" NotOnOrAfter="2014-05-28T00:19:08Z"><saml:AudienceRestriction><saml:Audience>{audience}</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AuthnStatement AuthnInstant="2014-05-28T00:16:07Z" SessionNotOnOrAfter="2014-05-29T00:16:08Z" SessionIndex="_30a4af50-c82b-0131-f8b5-782bcb56fcaa"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement></saml:Assertion>' +
          "</samlp:Response>";
        const base64xml = Buffer.from(xml).toString("base64");
        const container = { SAMLResponse: base64xml };
        const samlObj = new SAML(samlConfig);

        // Fake the current date to be after the valid time range
        fakeClock.restore();
        fakeClock = sinon.useFakeTimers(Date.parse("2014-05-28T00:13:07Z"));
        await assert.rejects(samlObj.validatePostResponseAsync(container), {
          message: "SAML assertion not yet valid",
        });
      });

      it("onelogin xml document with corrupted NotBefore time should fail", async () => {
        const unsignedXml =
          '<samlp:Response xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="R689b0733bccca22a137e3654830312332940b1be" Version="2.0" IssueInstant="2014-05-28T00:16:08Z" Destination="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>' +
          '<saml:Assertion xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="2.0" ID="pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa" IssueInstant="2014-05-28T00:16:08Z"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">ploer@subspacesw.com</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">' +
          '<saml:SubjectConfirmationData NotOnOrAfter="2014-05-28T00:19:08Z" Recipient="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"/></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="INVALID-DATE" NotOnOrAfter="2014-05-28T00:19:08Z"><saml:AudienceRestriction><saml:Audience>{audience}</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AuthnStatement AuthnInstant="2014-05-28T00:16:07Z" SessionNotOnOrAfter="2014-05-29T00:16:08Z" SessionIndex="_30a4af50-c82b-0131-f8b5-782bcb56fcaa"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement></saml:Assertion>' +
          "</samlp:Response>";

        const signingKey = fs.readFileSync(__dirname + "/static/key.pem");
        const signingCert = fs.readFileSync(__dirname + "/static/cert.pem", "utf-8");
        const signedXml = signXmlResponse(unsignedXml, { privateKey: signingKey });

        const base64xml = Buffer.from(signedXml).toString("base64");
        const container = { SAMLResponse: base64xml };
        const samlObj = new SAML({ ...samlConfig, cert: signingCert });

        fakeClock.restore();
        fakeClock = sinon.useFakeTimers(Date.parse("2014-05-28T00:13:07Z"));
        await assert.rejects(samlObj.validatePostResponseAsync(container), {
          message: "Error parsing NotBefore: 'INVALID-DATE' is not a valid date",
        });
      });

      it("onelogin xml document with current time equal to NotOnOrAfter (minus default clock skew) time should fail", async () => {
        const xml =
          '<samlp:Response xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="R689b0733bccca22a137e3654830312332940b1be" Version="2.0" IssueInstant="2014-05-28T00:16:08Z" Destination="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>' +
          '<saml:Assertion xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="2.0" ID="pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa" IssueInstant="2014-05-28T00:16:08Z"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/><ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><ds:Reference URI="#pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa"><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><ds:DigestValue>DCnPTQYBb1hKspbe6fg1U3q8xn4=</ds:DigestValue></ds:Reference></ds:SignedInfo><ds:SignatureValue>e0+aFomA0+JAY0f9tKqzIuqIVSSw7LiFUsneEDKPBWdiTz1sMdgr/2y1e9+rjaS2mRmCi/vSQLY3zTYz0hp6nJNU19+TWoXo9kHQyWT4KkeQL4Xs/gZ/AoKC20iHVKtpPps0IQ0Ml/qRoouSitt6Sf/WDz2LV/pWcH2hx5tv3xSw36hK2NQc7qw7r1mEXnvcjXReYo8rrVf7XHGGxNoRIEICUIi110uvsWemSXf0Z0dyb0FVYOWuSsQMDlzNpheADBifFO4UTfSEhFZvn8kVCGZUIwrbOhZ2d/+YEtgyuTg+qtslgfy4dwd4TvEcfuRzQTazeefprSFyiQckAXOjcw==</ds:SignatureValue><ds:KeyInfo><ds:X509Data><ds:X509Certificate>' +
          TEST_CERT +
          '</ds:X509Certificate></ds:X509Data></ds:KeyInfo></ds:Signature><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">ploer@subspacesw.com</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData NotOnOrAfter="2014-05-28T00:19:08Z" Recipient="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"/></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="2014-05-28T00:13:08Z" NotOnOrAfter="2014-05-28T00:19:08Z"><saml:AudienceRestriction><saml:Audience>{audience}</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AuthnStatement AuthnInstant="2014-05-28T00:16:07Z" SessionNotOnOrAfter="2014-05-29T00:16:08Z" SessionIndex="_30a4af50-c82b-0131-f8b5-782bcb56fcaa"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement></saml:Assertion>' +
          "</samlp:Response>";
        const base64xml = Buffer.from(xml).toString("base64");
        const container = { SAMLResponse: base64xml };
        const samlObj = new SAML(samlConfig);

        // Fake the current date to be after the valid time range
        fakeClock.restore();
        fakeClock = sinon.useFakeTimers(Date.parse("2014-05-28T00:19:08Z"));
        await assert.rejects(samlObj.validatePostResponseAsync(container), {
          message: "SAML assertion expired: clocks skewed too much",
        });
      });

      it("onelogin xml document with current time after NotOnOrAfter time (minus default clock skew) should fail", async () => {
        const xml =
          '<samlp:Response xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="R689b0733bccca22a137e3654830312332940b1be" Version="2.0" IssueInstant="2014-05-28T00:16:08Z" Destination="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>' +
          '<saml:Assertion xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="2.0" ID="pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa" IssueInstant="2014-05-28T00:16:08Z"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/><ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><ds:Reference URI="#pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa"><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><ds:DigestValue>DCnPTQYBb1hKspbe6fg1U3q8xn4=</ds:DigestValue></ds:Reference></ds:SignedInfo><ds:SignatureValue>e0+aFomA0+JAY0f9tKqzIuqIVSSw7LiFUsneEDKPBWdiTz1sMdgr/2y1e9+rjaS2mRmCi/vSQLY3zTYz0hp6nJNU19+TWoXo9kHQyWT4KkeQL4Xs/gZ/AoKC20iHVKtpPps0IQ0Ml/qRoouSitt6Sf/WDz2LV/pWcH2hx5tv3xSw36hK2NQc7qw7r1mEXnvcjXReYo8rrVf7XHGGxNoRIEICUIi110uvsWemSXf0Z0dyb0FVYOWuSsQMDlzNpheADBifFO4UTfSEhFZvn8kVCGZUIwrbOhZ2d/+YEtgyuTg+qtslgfy4dwd4TvEcfuRzQTazeefprSFyiQckAXOjcw==</ds:SignatureValue><ds:KeyInfo><ds:X509Data><ds:X509Certificate>' +
          TEST_CERT +
          '</ds:X509Certificate></ds:X509Data></ds:KeyInfo></ds:Signature><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">ploer@subspacesw.com</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData NotOnOrAfter="2014-05-28T00:19:08Z" Recipient="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"/></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="2014-05-28T00:13:08Z" NotOnOrAfter="2014-05-28T00:19:08Z"><saml:AudienceRestriction><saml:Audience>{audience}</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AuthnStatement AuthnInstant="2014-05-28T00:16:07Z" SessionNotOnOrAfter="2014-05-29T00:16:08Z" SessionIndex="_30a4af50-c82b-0131-f8b5-782bcb56fcaa"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement></saml:Assertion>' +
          "</samlp:Response>";
        const base64xml = Buffer.from(xml).toString("base64");
        const container = { SAMLResponse: base64xml };
        const samlObj = new SAML(samlConfig);

        // Fake the current date to be after the valid time range
        fakeClock.restore();
        fakeClock = sinon.useFakeTimers(Date.parse("2014-05-28T00:19:09Z"));
        await assert.rejects(samlObj.validatePostResponseAsync(container), {
          message: "SAML assertion expired: clocks skewed too much",
        });
      });

      it("onelogin xml document with current time after NotOnOrAfter time with accepted clock skew equal to -1 should pass", async () => {
        const xml =
          '<samlp:Response xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="R689b0733bccca22a137e3654830312332940b1be" Version="2.0" IssueInstant="2014-05-28T00:16:08Z" Destination="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>' +
          '<saml:Assertion xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="2.0" ID="pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa" IssueInstant="2014-05-28T00:16:08Z"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/><ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><ds:Reference URI="#pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa"><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><ds:DigestValue>DCnPTQYBb1hKspbe6fg1U3q8xn4=</ds:DigestValue></ds:Reference></ds:SignedInfo><ds:SignatureValue>e0+aFomA0+JAY0f9tKqzIuqIVSSw7LiFUsneEDKPBWdiTz1sMdgr/2y1e9+rjaS2mRmCi/vSQLY3zTYz0hp6nJNU19+TWoXo9kHQyWT4KkeQL4Xs/gZ/AoKC20iHVKtpPps0IQ0Ml/qRoouSitt6Sf/WDz2LV/pWcH2hx5tv3xSw36hK2NQc7qw7r1mEXnvcjXReYo8rrVf7XHGGxNoRIEICUIi110uvsWemSXf0Z0dyb0FVYOWuSsQMDlzNpheADBifFO4UTfSEhFZvn8kVCGZUIwrbOhZ2d/+YEtgyuTg+qtslgfy4dwd4TvEcfuRzQTazeefprSFyiQckAXOjcw==</ds:SignatureValue><ds:KeyInfo><ds:X509Data><ds:X509Certificate>' +
          TEST_CERT +
          '</ds:X509Certificate></ds:X509Data></ds:KeyInfo></ds:Signature><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">ploer@subspacesw.com</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData NotOnOrAfter="2014-05-28T00:19:08Z" Recipient="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"/></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="2014-05-28T00:13:08Z" NotOnOrAfter="2014-05-28T00:19:08Z"><saml:AudienceRestriction><saml:Audience>{audience}</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AuthnStatement AuthnInstant="2014-05-28T00:16:07Z" SessionNotOnOrAfter="2014-05-29T00:16:08Z" SessionIndex="_30a4af50-c82b-0131-f8b5-782bcb56fcaa"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement></saml:Assertion>' +
          "</samlp:Response>";
        const base64xml = Buffer.from(xml).toString("base64");
        const container = { SAMLResponse: base64xml };

        const samlConfig: SamlConfig = {
          entryPoint: "https://app.onelogin.com/trust/saml2/http-post/sso/371755",
          cert: TEST_CERT,
          acceptedClockSkewMs: -1,
          audience: false,
          issuer: "onesaml_login",
          wantAuthnResponseSigned: false,
        };
        const samlObj = new SAML(samlConfig);

        // Fake the current date to be after the valid time range
        fakeClock.restore();
        fakeClock = sinon.useFakeTimers(Date.parse("2014-05-28T00:20:09Z"));

        const { profile } = await samlObj.validatePostResponseAsync(container);
        assertRequired(profile, "profile must exist");
        expect(profile.nameID.startsWith("ploer")).to.be.true;
      });

      it("onelogin xml document with corrupted NotOnOrAfter time in Conditions should fail", async () => {
        const unsignedXml =
          '<samlp:Response xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="R689b0733bccca22a137e3654830312332940b1be" Version="2.0" IssueInstant="2014-05-28T00:16:08Z" Destination="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>' +
          '<saml:Assertion xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="2.0" ID="pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa" IssueInstant="2014-05-28T00:16:08Z"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">ploer@subspacesw.com</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">' +
          '<saml:SubjectConfirmationData NotOnOrAfter="2014-05-28T00:19:08Z" Recipient="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"/></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="2014-05-28T00:13:08Z" NotOnOrAfter="INVALID-DATE"><saml:AudienceRestriction><saml:Audience>{audience}</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AuthnStatement AuthnInstant="2014-05-28T00:16:07Z" SessionNotOnOrAfter="2014-05-29T00:16:08Z" SessionIndex="_30a4af50-c82b-0131-f8b5-782bcb56fcaa"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement></saml:Assertion>' +
          "</samlp:Response>";

        const signingKey = fs.readFileSync(__dirname + "/static/key.pem");
        const signingCert = fs.readFileSync(__dirname + "/static/cert.pem", "utf-8");
        const signedXml = signXmlResponse(unsignedXml, { privateKey: signingKey });

        const base64xml = Buffer.from(signedXml).toString("base64");
        const container = { SAMLResponse: base64xml };
        const samlObj = new SAML({ ...samlConfig, cert: signingCert });

        fakeClock.restore();
        fakeClock = sinon.useFakeTimers(Date.parse("2014-05-28T00:13:07Z"));
        await assert.rejects(samlObj.validatePostResponseAsync(container), {
          message: "Error parsing NotOnOrAfter: 'INVALID-DATE' is not a valid date",
        });
      });

      it("onelogin xml document with corrupted NotOnOrAfter time in SubjectConfirmationData should fail", async () => {
        const unsignedXml =
          '<samlp:Response xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="R689b0733bccca22a137e3654830312332940b1be" Version="2.0" IssueInstant="2014-05-28T00:16:08Z" Destination="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>' +
          '<saml:Assertion xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="2.0" ID="pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa" IssueInstant="2014-05-28T00:16:08Z"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">ploer@subspacesw.com</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">' +
          '<saml:SubjectConfirmationData NotOnOrAfter="INVALID-DATE" Recipient="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"/></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="2014-05-28T00:13:08Z" NotOnOrAfter="2014-05-28T00:19:08Z"><saml:AudienceRestriction><saml:Audience>{audience}</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AuthnStatement AuthnInstant="2014-05-28T00:16:07Z" SessionNotOnOrAfter="2014-05-29T00:16:08Z" SessionIndex="_30a4af50-c82b-0131-f8b5-782bcb56fcaa"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement></saml:Assertion>' +
          "</samlp:Response>";

        const signingKey = fs.readFileSync(__dirname + "/static/key.pem");
        const signingCert = fs.readFileSync(__dirname + "/static/cert.pem", "utf-8");
        const signedXml = signXmlResponse(unsignedXml, { privateKey: signingKey });

        const base64xml = Buffer.from(signedXml).toString("base64");
        const container = { SAMLResponse: base64xml };
        const samlObj = new SAML({ ...samlConfig, cert: signingCert });

        fakeClock.restore();
        fakeClock = sinon.useFakeTimers(Date.parse("2014-05-28T00:13:07Z"));
        await assert.rejects(samlObj.validatePostResponseAsync(container), {
          message: "Error parsing NotOnOrAfter: 'INVALID-DATE' is not a valid date",
        });
      });

      it("onelogin xml document with current time after MaxAssertionAge (minus default clock skew) should fail", async () => {
        const xml =
          '<samlp:Response xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="R689b0733bccca22a137e3654830312332940b1be" Version="2.0" IssueInstant="2014-05-28T00:16:08Z" Destination="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>' +
          '<saml:Assertion xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="2.0" ID="pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa" IssueInstant="2014-05-28T00:16:08Z"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/><ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><ds:Reference URI="#pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa"><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><ds:DigestValue>DCnPTQYBb1hKspbe6fg1U3q8xn4=</ds:DigestValue></ds:Reference></ds:SignedInfo><ds:SignatureValue>e0+aFomA0+JAY0f9tKqzIuqIVSSw7LiFUsneEDKPBWdiTz1sMdgr/2y1e9+rjaS2mRmCi/vSQLY3zTYz0hp6nJNU19+TWoXo9kHQyWT4KkeQL4Xs/gZ/AoKC20iHVKtpPps0IQ0Ml/qRoouSitt6Sf/WDz2LV/pWcH2hx5tv3xSw36hK2NQc7qw7r1mEXnvcjXReYo8rrVf7XHGGxNoRIEICUIi110uvsWemSXf0Z0dyb0FVYOWuSsQMDlzNpheADBifFO4UTfSEhFZvn8kVCGZUIwrbOhZ2d/+YEtgyuTg+qtslgfy4dwd4TvEcfuRzQTazeefprSFyiQckAXOjcw==</ds:SignatureValue><ds:KeyInfo><ds:X509Data><ds:X509Certificate>' +
          TEST_CERT +
          '</ds:X509Certificate></ds:X509Data></ds:KeyInfo></ds:Signature><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">ploer@subspacesw.com</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData NotOnOrAfter="2014-05-28T00:19:08Z" Recipient="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"/></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="2014-05-28T00:13:08Z" NotOnOrAfter="2014-05-28T00:19:08Z"><saml:AudienceRestriction><saml:Audience>{audience}</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AuthnStatement AuthnInstant="2014-05-28T00:16:07Z" SessionNotOnOrAfter="2014-05-29T00:16:08Z" SessionIndex="_30a4af50-c82b-0131-f8b5-782bcb56fcaa"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement></saml:Assertion>' +
          "</samlp:Response>";
        const base64xml = Buffer.from(xml).toString("base64");
        const container = { SAMLResponse: base64xml };

        // Set the maxAssertionAgeMs so that IssueInstant + maxAssertionAgeMs == 2014-05-28T00:16:09Z
        // Note that NotOnOrAfter == 2014-05-28T00:19:08Z in the response
        const samlObj = new SAML({ ...samlConfig, maxAssertionAgeMs: 1000 });

        // Fake the current date to be after the time limit set by maxAssertionAgeMs,
        // but before the limit set by NotOnOrAfter
        fakeClock.restore();
        fakeClock = sinon.useFakeTimers(Date.parse("2014-05-28T00:17:09Z"));
        await assert.rejects(samlObj.validatePostResponseAsync(container), {
          message: "SAML assertion expired: assertion too old",
        });
      });

      it("onelogin xml document with current time before MaxAssertionAge (minus default clock skew) should pass", async () => {
        const xml =
          '<samlp:Response xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="R689b0733bccca22a137e3654830312332940b1be" Version="2.0" IssueInstant="2014-05-28T00:16:08Z" Destination="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>' +
          '<saml:Assertion xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="2.0" ID="pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa" IssueInstant="2014-05-28T00:16:08Z"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/><ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><ds:Reference URI="#pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa"><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><ds:DigestValue>DCnPTQYBb1hKspbe6fg1U3q8xn4=</ds:DigestValue></ds:Reference></ds:SignedInfo><ds:SignatureValue>e0+aFomA0+JAY0f9tKqzIuqIVSSw7LiFUsneEDKPBWdiTz1sMdgr/2y1e9+rjaS2mRmCi/vSQLY3zTYz0hp6nJNU19+TWoXo9kHQyWT4KkeQL4Xs/gZ/AoKC20iHVKtpPps0IQ0Ml/qRoouSitt6Sf/WDz2LV/pWcH2hx5tv3xSw36hK2NQc7qw7r1mEXnvcjXReYo8rrVf7XHGGxNoRIEICUIi110uvsWemSXf0Z0dyb0FVYOWuSsQMDlzNpheADBifFO4UTfSEhFZvn8kVCGZUIwrbOhZ2d/+YEtgyuTg+qtslgfy4dwd4TvEcfuRzQTazeefprSFyiQckAXOjcw==</ds:SignatureValue><ds:KeyInfo><ds:X509Data><ds:X509Certificate>' +
          TEST_CERT +
          '</ds:X509Certificate></ds:X509Data></ds:KeyInfo></ds:Signature><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">ploer@subspacesw.com</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData NotOnOrAfter="2014-05-28T00:19:08Z" Recipient="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"/></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="2014-05-28T00:13:08Z" NotOnOrAfter="2014-05-28T00:19:08Z"><saml:AudienceRestriction><saml:Audience>{audience}</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AuthnStatement AuthnInstant="2014-05-28T00:16:07Z" SessionNotOnOrAfter="2014-05-29T00:16:08Z" SessionIndex="_30a4af50-c82b-0131-f8b5-782bcb56fcaa"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement></saml:Assertion>' +
          "</samlp:Response>";
        const base64xml = Buffer.from(xml).toString("base64");
        const container = { SAMLResponse: base64xml };

        // Set the maxAssertionAgeMs so that IssueInstant + maxAssertionAgeMs == 2014-05-28T00:16:09Z
        // Note that NotOnOrAfter == 2014-05-28T00:19:08Z in the response
        const samlObj = new SAML({ ...samlConfig, maxAssertionAgeMs: 1000 });

        // Fake the current date to be before the time limit set by maxAssertionAgeMs
        fakeClock.restore();
        fakeClock = sinon.useFakeTimers(Date.parse("2014-05-28T00:16:08Z"));

        const { profile } = await samlObj.validatePostResponseAsync(container);
        assertRequired(profile, "profile must exist");
        expect(profile.nameID.startsWith("ploer")).to.be.true;
      });

      it("onelogin xml document with corrupted IssueInstant time should fail", async () => {
        const unsignedXml = `
        <samlp:Response xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="R689b0733bccca22a137e3654830312332940b1be" Version="2.0" IssueInstant="2014-05-28T00:16:08Z" Destination="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>
        <saml:Assertion xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="2.0" ID="pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa" IssueInstant="INVALID-DATE"><saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">ploer@subspacesw.com</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData NotOnOrAfter="2014-05-28T00:19:08Z" Recipient="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"/></saml:SubjectConfirmation></saml:Subject>
        <saml:Conditions NotBefore="2014-05-28T00:19:00Z" NotOnOrAfter="2014-05-28T00:19:08Z"><saml:AudienceRestriction><saml:Audience>{audience}</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AuthnStatement AuthnInstant="2014-05-28T00:16:07Z" SessionNotOnOrAfter="2014-05-29T00:16:08Z" SessionIndex="_30a4af50-c82b-0131-f8b5-782bcb56fcaa"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement></saml:Assertion>
        </samlp:Response>
        `;

        const signingKey = fs.readFileSync(__dirname + "/static/key.pem");
        const signingCert = fs.readFileSync(__dirname + "/static/cert.pem", "utf-8");
        const signedXml = signXmlResponse(unsignedXml, { privateKey: signingKey });

        const base64xml = Buffer.from(signedXml).toString("base64");
        const container = { SAMLResponse: base64xml };
        const samlObj = new SAML({ ...samlConfig, cert: signingCert });

        fakeClock.restore();
        fakeClock = sinon.useFakeTimers(Date.parse("2014-05-28T00:13:07Z"));
        await assert.rejects(samlObj.validatePostResponseAsync(container), {
          message: "Error parsing IssueInstant: 'INVALID-DATE' is not a valid date",
        });
      });

      it("onelogin xml document with audience and no AudienceRestriction should not pass", async () => {
        const signingCert = fs.readFileSync(__dirname + "/static/cert.pem", "utf-8");
        const xml = `<samlp:Response xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="pfx1e2f568f-ba3e-9d81-af54-ab41fdbc648e" Version="2.0" IssueInstant="2014-05-28T00:16:08Z" Destination="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50">
  <saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
  <ds:SignedInfo><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
    <ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>
  <ds:Reference URI="#pfx1e2f568f-ba3e-9d81-af54-ab41fdbc648e"><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><ds:DigestValue>EiaOqK9GBBENUFaN2AVlYOvlq8E=</ds:DigestValue></ds:Reference></ds:SignedInfo><ds:SignatureValue>vUf14oqiSWa2xhU1hZBEF3Z9JcYsVzWq+B1vXg0vQfN8GEfmooRogtA3oLs2SKhtpcVwEPuIVf6hRnEL713STMBbYxhnk/om+zMor82bQgn+eR/n3g3AWFPbLGxHbYXK06X47Vo+RRm5H8xVb9FiECXYs6CUCtVksAnitDp0pFgB8G5FKx2OwKALg1LNsKItkzWfI7yaQPKyywFwGgDqXVJYiD1v1HKb3JEvpiL96vVOYSI1+7j/Jy2brYJfs4ADnuAKEXVDgYdtaIQrGa+0x2W9KInCWgR+H40nBTHecE5NGeE01/s0is8nVbmSVrdpBpw44t2xcnp+TzozTGTm2g==</ds:SignatureValue>
<ds:KeyInfo><ds:X509Data><ds:X509Certificate>MIIDtTCCAp2gAwIBAgIJAKg4VeVcIDz1MA0GCSqGSIb3DQEBBQUAMEUxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpTb21lLVN0YXRlMSEwHwYDVQQKExhJbnRlcm5ldCBXaWRnaXRzIFB0eSBMdGQwHhcNMTUwODEzMDE1NDIwWhcNMTUwOTEyMDE1NDIwWjBFMQswCQYDVQQGEwJVUzETMBEGA1UECBMKU29tZS1TdGF0ZTEhMB8GA1UEChMYSW50ZXJuZXQgV2lkZ2l0cyBQdHkgTHRkMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxG3ouM7U+fXbJt69X1H6d4UNg/uRr06pFuU9RkfIwNC+yaXyptqB3ynXKsL7BFt4DCd0fflRvJAx3feJIDp16wN9GDVHcufWMYPhh2j5HcTW/j9JoIJzGhJyvO00YKBt+hHy83iN1SdChKv5y0iSyiPP5GnqFw+ayyHoM6hSO0PqBou1Xb0ZSIE+DHosBnvVna5w2AiPY4xrJl9yZHZ4Q7DfMiYTgstjETio4bX+6oLiBnYktn7DjdEslqhffVme4PuBxNojI+uCeg/sn4QVLd/iogMJfDWNuLD8326Mi/FE9cCRvFlvAiMSaebMI3zPaySsxTK7Zgj5TpEbmbHI9wIDAQABo4GnMIGkMB0GA1UdDgQWBBSVGgvoW4MhMuzBGce29PY8vSzHFzB1BgNVHSMEbjBsgBSVGgvoW4MhMuzBGce29PY8vSzHF6FJpEcwRTELMAkGA1UEBhMCVVMxEzARBgNVBAgTClNvbWUtU3RhdGUxITAfBgNVBAoTGEludGVybmV0IFdpZGdpdHMgUHR5IEx0ZIIJAKg4VeVcIDz1MAwGA1UdEwQFMAMBAf8wDQYJKoZIhvcNAQEFBQADggEBAJu1rqs+anD74dbdwgd3CnqnQsQDJiEXmBhG2leaGt3ve9b/9gKaJg2pyb2NyppDe1uLqh6nNXDuzg1oNZrPz5pJL/eCXPl7FhxhMUi04TtLf8LeNTCIWYZiFuO4pmhohHcv8kRvYR1+6SkLTC8j/TZerm7qvesSiTQFNapa1eNdVQ8nFwVkEtWl+JzKEM1BlRcn42sjJkijeFp7DpI7pU+PnYeiaXpRv5pJo8ogM1iFxN+SnfEs0EuQ7fhKIG9aHKi7bKZ7L6SyX7MDIGLeulEU6lf5D9BfXNmcMambiS0pXhL2QXajt96UBq8FT2KNXY8XNtR4y6MyyCzhaiZZcc8=</ds:X509Certificate></ds:X509Data></ds:KeyInfo></ds:Signature>
  <samlp:Status>
    <samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/>
  </samlp:Status>
  <saml:Assertion xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="2.0" ID="pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa" IssueInstant="2014-05-28T00:16:08Z">
    <saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer>
    <saml:Subject>
      <saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">ploer@subspacesw.com</saml:NameID>
      <saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">
        <saml:SubjectConfirmationData NotOnOrAfter="2014-05-28T00:19:08Z" Recipient="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"/>
      </saml:SubjectConfirmation>
    </saml:Subject>
    <saml:Conditions NotBefore="2014-05-28T00:13:08Z" NotOnOrAfter="2014-05-28T00:19:08Z"/>
    <saml:AuthnStatement AuthnInstant="2014-05-28T00:16:07Z" SessionNotOnOrAfter="2014-05-29T00:16:08Z" SessionIndex="_30a4af50-c82b-0131-f8b5-782bcb56fcaa">
      <saml:AuthnContext>
        <saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef>
      </saml:AuthnContext>
    </saml:AuthnStatement>
  </saml:Assertion>
</samlp:Response>`;
        const base64xml = Buffer.from(xml).toString("base64");
        const container = { SAMLResponse: base64xml };

        const samlConfig: SamlConfig = {
          entryPoint: "https://app.onelogin.com/trust/saml2/http-post/sso/371755",
          audience: "http://sp.example.com",
          acceptedClockSkewMs: -1,
          cert: signingCert,
          issuer: "onesaml_login",
          wantAssertionsSigned: false,
        };
        const samlObj = new SAML(samlConfig);
        await assert.rejects(samlObj.validatePostResponseAsync(container), {
          message: "SAML assertion has no AudienceRestriction",
        });
      });

      it("onelogin xml document with audience not matching AudienceRestriction should not pass", async () => {
        const signingCert = fs.readFileSync(__dirname + "/static/cert.pem", "utf-8");
        const xml = `<samlp:Response xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="pfxeda919ac-e0ca-fff5-4987-efd3b459a1d5" Version="2.0" IssueInstant="2014-05-28T00:16:08Z" Destination="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50">
  <saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
  <ds:SignedInfo><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
    <ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>
  <ds:Reference URI="#pfxeda919ac-e0ca-fff5-4987-efd3b459a1d5"><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><ds:DigestValue>SYyNspaWBrl3SgQGlt8RysQRfXI=</ds:DigestValue></ds:Reference></ds:SignedInfo><ds:SignatureValue>km4aqMCXkupbpp/YR2+dOD2BbnGKO1MDVRMPKSzSx3BwsXhBBYlFNx1ht46zZDSQF60iAHd/vHGcJV8V7QNCeuIgfmTNkh2jtcF5ghRNfmvgpLRwRt1dT/UqApzo8kdRKXcUu0yxziPKFoE6EEvF/NR+YV/aAngEH3dCbOsN1u56zBOa4DZ7EMoWgwmPodaHOgNy4xazv5+Cb+mQM8YC1060EvipIrRU28BWIb3teUlfHL3L8AMlyCqjkw21dkbVOcHNy080oWW+MkjMGbt6r3y2iwpDfJMk5R63T5fXFDIStbVD7ss2BzqGccBykHomm/hU9GYWoO+0kW/reLiXiw==</ds:SignatureValue>
<ds:KeyInfo><ds:X509Data><ds:X509Certificate>MIIDtTCCAp2gAwIBAgIJAKg4VeVcIDz1MA0GCSqGSIb3DQEBBQUAMEUxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpTb21lLVN0YXRlMSEwHwYDVQQKExhJbnRlcm5ldCBXaWRnaXRzIFB0eSBMdGQwHhcNMTUwODEzMDE1NDIwWhcNMTUwOTEyMDE1NDIwWjBFMQswCQYDVQQGEwJVUzETMBEGA1UECBMKU29tZS1TdGF0ZTEhMB8GA1UEChMYSW50ZXJuZXQgV2lkZ2l0cyBQdHkgTHRkMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxG3ouM7U+fXbJt69X1H6d4UNg/uRr06pFuU9RkfIwNC+yaXyptqB3ynXKsL7BFt4DCd0fflRvJAx3feJIDp16wN9GDVHcufWMYPhh2j5HcTW/j9JoIJzGhJyvO00YKBt+hHy83iN1SdChKv5y0iSyiPP5GnqFw+ayyHoM6hSO0PqBou1Xb0ZSIE+DHosBnvVna5w2AiPY4xrJl9yZHZ4Q7DfMiYTgstjETio4bX+6oLiBnYktn7DjdEslqhffVme4PuBxNojI+uCeg/sn4QVLd/iogMJfDWNuLD8326Mi/FE9cCRvFlvAiMSaebMI3zPaySsxTK7Zgj5TpEbmbHI9wIDAQABo4GnMIGkMB0GA1UdDgQWBBSVGgvoW4MhMuzBGce29PY8vSzHFzB1BgNVHSMEbjBsgBSVGgvoW4MhMuzBGce29PY8vSzHF6FJpEcwRTELMAkGA1UEBhMCVVMxEzARBgNVBAgTClNvbWUtU3RhdGUxITAfBgNVBAoTGEludGVybmV0IFdpZGdpdHMgUHR5IEx0ZIIJAKg4VeVcIDz1MAwGA1UdEwQFMAMBAf8wDQYJKoZIhvcNAQEFBQADggEBAJu1rqs+anD74dbdwgd3CnqnQsQDJiEXmBhG2leaGt3ve9b/9gKaJg2pyb2NyppDe1uLqh6nNXDuzg1oNZrPz5pJL/eCXPl7FhxhMUi04TtLf8LeNTCIWYZiFuO4pmhohHcv8kRvYR1+6SkLTC8j/TZerm7qvesSiTQFNapa1eNdVQ8nFwVkEtWl+JzKEM1BlRcn42sjJkijeFp7DpI7pU+PnYeiaXpRv5pJo8ogM1iFxN+SnfEs0EuQ7fhKIG9aHKi7bKZ7L6SyX7MDIGLeulEU6lf5D9BfXNmcMambiS0pXhL2QXajt96UBq8FT2KNXY8XNtR4y6MyyCzhaiZZcc8=</ds:X509Certificate></ds:X509Data></ds:KeyInfo></ds:Signature>
  <samlp:Status>
    <samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/>
  </samlp:Status>
  <saml:Assertion xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="2.0" ID="pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa" IssueInstant="2014-05-28T00:16:08Z">
    <saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer>
    <saml:Subject>
      <saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">ploer@subspacesw.com</saml:NameID>
      <saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">
        <saml:SubjectConfirmationData NotOnOrAfter="2014-05-28T00:19:08Z" Recipient="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"/>
      </saml:SubjectConfirmation>
    </saml:Subject>
    <saml:Conditions NotBefore="2014-05-28T00:13:08Z" NotOnOrAfter="2014-05-28T00:19:08Z">
      <saml:AudienceRestriction>
        <saml:Audience>{audience}</saml:Audience>
      </saml:AudienceRestriction>
    </saml:Conditions>
    <saml:AuthnStatement AuthnInstant="2014-05-28T00:16:07Z" SessionNotOnOrAfter="2014-05-29T00:16:08Z" SessionIndex="_30a4af50-c82b-0131-f8b5-782bcb56fcaa">
      <saml:AuthnContext>
        <saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef>
      </saml:AuthnContext>
    </saml:AuthnStatement>
  </saml:Assertion>
</samlp:Response>`;
        const base64xml = Buffer.from(xml).toString("base64");
        const container = { SAMLResponse: base64xml };

        const samlConfig: SamlConfig = {
          entryPoint: "https://app.onelogin.com/trust/saml2/http-post/sso/371755",
          audience: "http://sp.example.com",
          acceptedClockSkewMs: -1,
          cert: signingCert,
          issuer: "onesaml_login",
          wantAssertionsSigned: false,
        };
        const samlObj = new SAML(samlConfig);
        await assert.rejects(samlObj.validatePostResponseAsync(container), {
          message: "SAML assertion audience mismatch",
        });
      });

      it("onelogin xml document with audience matching AudienceRestriction should pass", async () => {
        const signingCert = fs.readFileSync(__dirname + "/static/cert.pem", "utf-8");
        const xml = `<samlp:Response xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="pfx9bf4fce3-7a3c-5530-22c9-d7c66cdaac4e" Version="2.0" IssueInstant="2014-05-28T00:16:08Z" Destination="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50">
  <saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
  <ds:SignedInfo><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
    <ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>
  <ds:Reference URI="#pfx9bf4fce3-7a3c-5530-22c9-d7c66cdaac4e"><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><ds:DigestValue>SWMNMbWptW3RzRXBEHv4kvu3rbU=</ds:DigestValue></ds:Reference></ds:SignedInfo><ds:SignatureValue>LiyXwB09CavCEDR3SkjRzuoUn2Mruk8pBfWyN1K7zefjbtahezIljOYIIumZAsC8hrVndeG7Pk2rE6pL04vcRcASmPlmyytb0yYwyjmhEhTR6nmfBMS0a9mwvQE5/4+TecVW4yWUcMd7m12EhWz8+RcmHRnKWSCsVDxlF0zPUHgJc8n6Yr489mNcRFGKpaWtcH9vEvf689jxNgdqXjS5SvSBJClZd6ir0KFH799etbY5TORx3p0zR+okq7ZP4A9XVcnHWZw4e3KBJ04xQ31fDcr2Cgi3qkLEaaj5HkKAE4PWZ/5G75VHFM3xAZ9rsVL5mwQAJRXFgNbSYCWOUZ4NCg==</ds:SignatureValue>
<ds:KeyInfo><ds:X509Data><ds:X509Certificate>MIIDtTCCAp2gAwIBAgIJAKg4VeVcIDz1MA0GCSqGSIb3DQEBBQUAMEUxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpTb21lLVN0YXRlMSEwHwYDVQQKExhJbnRlcm5ldCBXaWRnaXRzIFB0eSBMdGQwHhcNMTUwODEzMDE1NDIwWhcNMTUwOTEyMDE1NDIwWjBFMQswCQYDVQQGEwJVUzETMBEGA1UECBMKU29tZS1TdGF0ZTEhMB8GA1UEChMYSW50ZXJuZXQgV2lkZ2l0cyBQdHkgTHRkMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxG3ouM7U+fXbJt69X1H6d4UNg/uRr06pFuU9RkfIwNC+yaXyptqB3ynXKsL7BFt4DCd0fflRvJAx3feJIDp16wN9GDVHcufWMYPhh2j5HcTW/j9JoIJzGhJyvO00YKBt+hHy83iN1SdChKv5y0iSyiPP5GnqFw+ayyHoM6hSO0PqBou1Xb0ZSIE+DHosBnvVna5w2AiPY4xrJl9yZHZ4Q7DfMiYTgstjETio4bX+6oLiBnYktn7DjdEslqhffVme4PuBxNojI+uCeg/sn4QVLd/iogMJfDWNuLD8326Mi/FE9cCRvFlvAiMSaebMI3zPaySsxTK7Zgj5TpEbmbHI9wIDAQABo4GnMIGkMB0GA1UdDgQWBBSVGgvoW4MhMuzBGce29PY8vSzHFzB1BgNVHSMEbjBsgBSVGgvoW4MhMuzBGce29PY8vSzHF6FJpEcwRTELMAkGA1UEBhMCVVMxEzARBgNVBAgTClNvbWUtU3RhdGUxITAfBgNVBAoTGEludGVybmV0IFdpZGdpdHMgUHR5IEx0ZIIJAKg4VeVcIDz1MAwGA1UdEwQFMAMBAf8wDQYJKoZIhvcNAQEFBQADggEBAJu1rqs+anD74dbdwgd3CnqnQsQDJiEXmBhG2leaGt3ve9b/9gKaJg2pyb2NyppDe1uLqh6nNXDuzg1oNZrPz5pJL/eCXPl7FhxhMUi04TtLf8LeNTCIWYZiFuO4pmhohHcv8kRvYR1+6SkLTC8j/TZerm7qvesSiTQFNapa1eNdVQ8nFwVkEtWl+JzKEM1BlRcn42sjJkijeFp7DpI7pU+PnYeiaXpRv5pJo8ogM1iFxN+SnfEs0EuQ7fhKIG9aHKi7bKZ7L6SyX7MDIGLeulEU6lf5D9BfXNmcMambiS0pXhL2QXajt96UBq8FT2KNXY8XNtR4y6MyyCzhaiZZcc8=</ds:X509Certificate></ds:X509Data></ds:KeyInfo></ds:Signature>
  <samlp:Status>
    <samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/>
  </samlp:Status>
  <saml:Assertion xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="2.0" ID="pfx3b63c7be-fe86-62fd-8cb5-16ab6273efaa" IssueInstant="2014-05-28T00:16:08Z">
    <saml:Issuer>https://app.onelogin.com/saml/metadata/371755</saml:Issuer>
    <saml:Subject>
      <saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">ploer@subspacesw.com</saml:NameID>
      <saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">
        <saml:SubjectConfirmationData NotOnOrAfter="2014-05-28T00:19:08Z" Recipient="{recipient}" InResponseTo="_a6fc46be84e1e3cf3c50"/>
      </saml:SubjectConfirmation>
    </saml:Subject>
    <saml:Conditions NotBefore="2014-05-28T00:13:08Z" NotOnOrAfter="2014-05-28T00:19:08Z">
      <saml:AudienceRestriction>
        <saml:Audience>http://sp.example.com</saml:Audience>
      </saml:AudienceRestriction>
    </saml:Conditions>
    <saml:AuthnStatement AuthnInstant="2014-05-28T00:16:07Z" SessionNotOnOrAfter="2014-05-29T00:16:08Z" SessionIndex="_30a4af50-c82b-0131-f8b5-782bcb56fcaa">
      <saml:AuthnContext>
        <saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef>
      </saml:AuthnContext>
    </saml:AuthnStatement>
  </saml:Assertion>
</samlp:Response>`;
        const base64xml = Buffer.from(xml).toString("base64");
        const container = { SAMLResponse: base64xml };

        const samlConfig: SamlConfig = {
          entryPoint: "https://app.onelogin.com/trust/saml2/http-post/sso/371755",
          audience: "http://sp.example.com",
          acceptedClockSkewMs: -1,
          cert: signingCert,
          issuer: "onesaml_login",
          wantAssertionsSigned: false,
        };
        const samlObj = new SAML(samlConfig);

        const { profile } = await samlObj.validatePostResponseAsync(container);
        assertRequired(profile, "profile must exist");
        expect(profile.nameID.startsWith("ploer")).to.be.true;
      });
    });
  });
  describe("validatePostRequest()", function () {
    const signingKey = fs.readFileSync(__dirname + "/static/key.pem", "ascii");
    const signingCert = fs.readFileSync(__dirname + "/static/cert.pem", "ascii");
    let samlObj: SAML;

    beforeEach(function () {
      samlObj = new SAML({
        cert: signingCert,
        issuer: "onesaml_login",
      });
    });

    it("errors if not xml", async function () {
      const body = {
        SAMLRequest: "asdf",
      };
      await assert.rejects(samlObj.validatePostRequestAsync(body), {
        message: "Not a valid XML document",
      });
    });

    it("errors if bad xml", async function () {
      const badXml =
        '<xml xmlns="a" xmlns:c="./lite">\n' +
        "\t<child>test</child>\n" +
        "\t<child22><<</child>\n" +
        "\t<child/>\n" +
        "</xml>";
      await assert.rejects(parseDomFromString(badXml), {
        message:
          "[xmldom error]\telement parse error: Error: invalid tagName:<<\n" + "@#[line:3,col:11]",
      });
    });

    // it("errors if bad signature", async () => {
    //   const body = {
    //     SAMLRequest: fs.readFileSync(
    //       __dirname + "/static/logout_request_with_bad_signature.xml",
    //       "base64"
    //     ),
    //   };
    //   await assert.rejects(samlObj.validatePostRequestAsync(body), {
    //     message: "Invalid signature on documentElement",
    //   });
    //});

    it("returns profile for valid signature", async () => {
      const body = {
        SAMLRequest: fs.readFileSync(
          __dirname + "/static/logout_request_with_good_signature.xml",
          "base64"
        ),
      };
      const { profile } = await samlObj.validatePostRequestAsync(body);
      expect(profile).to.deep.equal({
        ID: "pfxd4d369e8-9ea1-780c-aff8-a1d11a9862a1",
        issuer: "http://sp.example.com/demo1/metadata.php",
        nameID: "ONELOGIN_f92cc1834efc0f73e9c09f482fce80037a6251e7",
        nameIDFormat: "urn:oasis:names:tc:SAML:2.0:nameid-format:transient",
      });
    });
    it("returns profile for valid signature including session index", async () => {
      const body = {
        SAMLRequest: fs.readFileSync(
          __dirname + "/static/logout_request_with_session_index.xml",
          "base64"
        ),
      };
      const { profile } = await samlObj.validatePostRequestAsync(body);
      expect(profile).to.deep.equal({
        ID: "pfxd4d369e8-9ea1-780c-aff8-a1d11a9862a1",
        issuer: "http://sp.example.com/demo1/metadata.php",
        nameID: "ONELOGIN_f92cc1834efc0f73e9c09f482fce80037a6251e7",
        nameIDFormat: "urn:oasis:names:tc:SAML:2.0:nameid-format:transient",
        sessionIndex: "1",
      });
    });
    it("returns profile for valid signature with encrypted nameID", async () => {
      const samlObj = new SAML({
        cert: fs.readFileSync(__dirname + "/static/cert.pem", "ascii"),
        decryptionPvk: fs.readFileSync(__dirname + "/static/key.pem", "ascii"),
        issuer: "onelogin_saml",
      });
      const body = {
        SAMLRequest: fs.readFileSync(
          __dirname + "/static/logout_request_with_encrypted_name_id.xml",
          "base64"
        ),
      };
      const { profile } = await samlObj.validatePostRequestAsync(body);
      expect(profile).to.deep.equal({
        ID: "pfx087316a5-2dfb-cc05-2ba9-b46751936ff5",
        issuer: "http://sp.example.com/demo1/metadata.php",
        nameID: "ONELOGIN_f92cc1834efc0f73e9c09f482fce80037a6251e7",
        nameIDFormat: "urn:oasis:names:tc:SAML:2.0:nameid-format:transient",
        sessionIndex: "1",
      });
    });

    it("check conflicting profile fields with data from attributes", async () => {
      const testSAMLObj = new SAML({
        cert: signingCert,
        issuer: "okta",
        audience: false,
        wantAssertionsSigned: false,
      });
      const xml =
        '<Response xmlns="urn:oasis:names:tc:SAML:2.0:protocol" ID="response0">' +
        '<saml2:Assertion xmlns:saml2="urn:oasis:names:tc:SAML:2.0:assertion" Version="2.0">' +
        "<saml:Issuer>http://idp.example.com/metadata.php</saml:Issuer>" +
        "<saml2:AttributeStatement>" +
        '<saml2:Attribute Name="attributeName" ' +
        'NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified">' +
        '<saml2:AttributeValue xmlns:xs="http://www.w3.org/2001/XMLSchema" ' +
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
        'xsi:type="xs:string"/>' +
        "</saml2:Attribute>" +
        '<saml2:Attribute Name="issuer" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic">' +
        '<saml2:AttributeValue xsi:type="xs:string">test</saml2:AttributeValue>' +
        "</saml2:Attribute>" +
        "</saml2:AttributeStatement>" +
        "</saml2:Assertion>" +
        "</Response>";
      const signedXml = signXmlResponse(xml, { privateKey: signingKey });
      const { profile } = await testSAMLObj.validatePostResponseAsync({
        SAMLResponse: Buffer.from(signedXml).toString("base64"),
      });

      assertRequired(profile, "profile must exist");
      expect(profile.issuer).to.not.be.equal("test");
    });
  });

  it("validatePostRequest errors for encrypted nameID with wrong decryptionPvk", async () => {
    const samlObj = new SAML({
      cert: fs.readFileSync(__dirname + "/static/cert.pem", "ascii"),
      decryptionPvk: fs.readFileSync(__dirname + "/static/acme_tools_com.key", "ascii"),
      issuer: "onesaml_login",
    });
    const body = {
      SAMLRequest: fs.readFileSync(
        __dirname + "/static/logout_request_with_encrypted_name_id.xml",
        "base64"
      ),
    };
    if (process.versions.node.split(".")[0] === "18") {
      await assert.rejects(samlObj.validatePostRequestAsync(body), {
        message: "error:02000079:rsa routines::oaep decoding error",
      });
    } else {
      await assert.rejects(samlObj.validatePostRequestAsync(body), {
        message:
          "error:04099079:rsa routines:RSA_padding_check_PKCS1_OAEP_mgf1:oaep decoding error",
      });
    }
  });

  it("errors if bad privateKey to requestToURL", async () => {
    const samlObj = new SAML({
      entryPoint: "http://localhost",
      privateKey:
        "-----BEGIN CERTIFICATE-----\n" +
        "8mvhvrcCOiJ3mjgKNN1F31jOBJuZNmq0U7n9v+Z+3NfyU/0E9jkrnFvm5ks+p8kl\n" +
        "BjuBk9RAkazsU9l02XMS/VxOOIifxKC7R9bDtx0hjolYxgqxPIO5s4rmjj0rLzvo\n" +
        "vQTTTx/tB5e+hbdx922QSeTjP4DO4ms6cIexcH+ZEUOJ3wXiHToJW83SXLRtwPI9\n" +
        "JbWKeS9nWPnzcedbDNZkGtohW5vf32BHuvLsWcl6eFXRSkdX/7+rgpXmDRB7caQ+\n" +
        "2SXVY7ORily7LTKg1cFmuKHDzKTGFIp5/GU6dwIDAQABAoIBAArgFQ+Uk4UN4diY\n" +
        "gJWCAaQlTVmP0UEHZQt/NmJrc9ZVduuhOP0hH6gF53nREHz5UQb4nXB2Ksa3MtYD\n" +
        "Z1vhJcu/T7pvmib4q+Ij6oAmlyeL/xwVY3IUURMxX3tCdPItlk4PEFELKeqQOiIS\n" +
        "7B0DYxWfJbMle3c95w5ruYEr2A+fHCKVSlDpg7uPd9VQ6t7bGMZZvc9tDSC1qPXQ\n" +
        "Gd/WOMXxi+t/TpyVZ6tOcEekQzAMLmWElUUPx3TJ0ur0Zl2LZ7IvQEXXias4lUHV\n" +
        "fnH3akDCMmdhlJSVqUfplrh85zAOh6fLloZagphj/Kpgfw1TZ+njSDYqSLYE0NZ1\n" +
        "j+83feECgYEA2aNGgbc+t6QLrJJ63l9Mz541lVV3IUAxZ5ACqOnMkQVuLoa5IMwM\n" +
        "oENIo38ptfHQqjQ9x8/tEINFqOHnQuOJ/+1xP9f0Me+0clRDCqjGYqNYgmakKyD7\n" +
        "vey/q6kwHk679RVGiI1p+HdoA+CbEKWHJiRxE0RhAA3G3wGAq7kpJocCgYEAxp4/\n" +
        "tCft+eHVRivspfDN//axc2TR6qWP9E1ueGvbiXPXv0Puag0W9cER/df/s5jW4Rqg\n" +
        "CE8649HPUZ0FJT+YaeKgu2Sw9SMcGl4/uyHzg7KnXIeYyQZJPqQkKyXmIix8cw3+\n" +
        "HBGRtwX5nOy0DgFdaMiH0F08peNI9QHKKTBoWJECgYEAyymJ1ekzWMaAR1Zt8EvS\n" +
        "LjWoG4EuthFwjRZ4BSpLVk1Vb4VAKAeS+cAVfNpmG3xip6Ag0/ebe0CvtFk9QsmZ\n" +
        "txj2EP0M7div/9H8y2SF3OpS41fhhIlDtyXcPuivDHu/Jaf4sdwgwlrk9EmlN0Lu\n" +
        "CIMYMz4vtpclwGNss+EjMt0CgYEAqepD0Vm/iuCaVhfJsgSaFvnywSdlNfpBdtyv\n" +
        "PzH2dFa4IZZ55hwgoklznNgmlnyQh68BbVpqpO+fDtDnz//h4ePRYb84a96Hcj9j\n" +
        "AjJ/YxF5f/04xfEsw/wkPQ2FHYM1TDCSTWzyXcMs0gTl3H1qbfPvzF+XPMt+ZKwN\n" +
        "SMNy4SECgYB3ig6t+XVfNkw8oBOh0Gx37XKbmImXsA8ucDAX9KUbMIvD03XCEf34\n" +
        "jF3SNJh0SmHoT62vc+cJqPxMDP6E7Q1nZxsEyaAkKr2H4dSM4SlRm0VB+bS+jXsz\n" +
        "PCiRGSm8eupuxfix05LMMreo4mC7e3Ir4JhdCsXxAMZIvbNyXcvUMA==\n" +
        "-----END CERTIFICATE-----\n",
      cert: FAKE_CERT,
      issuer: "onesaml_login",
    });
    const request =
      '<?xml version=\\"1.0\\"?><samlp:AuthnRequest xmlns:samlp=\\"urn:oasis:names:tc:SAML:2.0:protocol\\" ID=\\"_ea40a8ab177df048d645\\" Version=\\"2.0\\" IssueInstant=\\"2017-08-22T19:30:01.363Z\\" ProtocolBinding=\\"urn:oasis:names$tc:SAML:2.0:bindings:HTTP-POST\\" AssertionConsumerServiceURL=\\"https://example.com/login/callback\\" Destination=\\"https://www.example.com\\"><saml:Issuer xmlns:saml=\\"urn:oasis:names:tc:SAML:2.0:assertion\\">onelogin_saml</saml:Issuer><s$mlp:NameIDPolicy xmlns:samlp=\\"urn:oasis:names:tc:SAML:2.0:protocol\\" Format=\\"urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress\\" AllowCreate=\\"true\\"/><samlp:RequestedAuthnContext xmlns:samlp=\\"urn:oasis:names:tc:SAML:2.0:protoc$l\\" Comparison=\\"exact\\"><saml:AuthnContextClassRef xmlns:saml=\\"urn:oasis:names:tc:SAML:2.0:assertion\\">urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></samlp:RequestedAuthnContext></samlp$AuthnRequest>';
    if (process.versions.node.split(".")[0] === "18") {
      await assert.rejects(samlObj._requestToUrlAsync(request, null, "authorize", {}), {
        message: "Failed to read private key",
      });
    } else {
      await assert.rejects(samlObj._requestToUrlAsync(request, null, "authorize", {}), {
        message: "error:0909006C:PEM routines:get_name:no start line",
      });
    }
  });

  describe("validateRedirect()", function () {
    describe("idp slo", function () {
      let samlObj: SAML;
      let fakeClock: sinon.SinonFakeTimers;
      beforeEach(function () {
        samlObj = new SAML({
          cert: fs.readFileSync(__dirname + "/static/acme_tools_com.cert", "ascii"),
          idpIssuer: "http://localhost:20000/saml2/idp/metadata.php",
          issuer: "onesaml_login",
        });
        this.request = Object.assign(
          {},
          JSON.parse(fs.readFileSync(__dirname + "/static/idp_slo_redirect.json", "utf8"))
        );
        fakeClock = sinon.useFakeTimers(Date.parse("2018-04-11T14:08:00Z"));
      });
      afterEach(function () {
        fakeClock.restore();
      });
      it("errors if bad xml", async function () {
        const body = {
          SAMLRequest: "asdf",
        };
        await assert.rejects(samlObj.validateRedirectAsync(body, this.request.originalQuery));
      });
      it("errors if idpIssuer is set and issuer is wrong", async function () {
        samlObj.options.idpIssuer = "foo";
        await assert.rejects(
          samlObj.validateRedirectAsync(this.request, this.request.originalQuery),
          {
            message:
              "Unknown SAML issuer. Expected: foo Received: http://localhost:20000/saml2/idp/metadata.php",
          }
        );
      });
      it("errors if request has expired", async function () {
        fakeClock.restore();
        fakeClock = sinon.useFakeTimers(Date.parse("2100-04-11T14:08:00Z"));

        await assert.rejects(
          samlObj.validateRedirectAsync(this.request, this.request.originalQuery),
          { message: "SAML assertion expired: clocks skewed too much" }
        );
      });
      it("errors if request has a bad signature", async function () {
        this.request.Signature = "foo";
        await assert.rejects(
          samlObj.validateRedirectAsync(this.request, this.request.originalQuery),
          { message: "Invalid query signature" }
        );
      });
      it("returns profile for valid signature including session index", async function () {
        const { profile } = await samlObj.validateRedirectAsync(
          this.request,
          this.request.originalQuery
        );
        expect(profile).to.deep.equal({
          ID: "_8f0effde308adfb6ae7f1e29b414957fc320f5636f",
          issuer: "http://localhost:20000/saml2/idp/metadata.php",
          nameID: "stavros@workable.com",
          nameIDFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
          sessionIndex: "_00bf7b2d5d9d3c970217eecefb1194bef3362a618e",
        });
      });
    });
    describe("sp slo", function () {
      let samlObj: SAML;

      beforeEach(function () {
        samlObj = new SAML({
          cert: fs.readFileSync(__dirname + "/static/acme_tools_com.cert", "ascii"),
          idpIssuer: "http://localhost:20000/saml2/idp/metadata.php",
          validateInResponseTo: ValidateInResponseTo.always,
          issuer: "onesaml_login",
        });
        this.request = Object.assign(
          {},
          JSON.parse(fs.readFileSync(__dirname + "/static/sp_slo_redirect.json", "utf8"))
        );
      });
      afterEach(async function () {
        await samlObj.cacheProvider.removeAsync("_79db1e7ad12ca1d63e5b");
      });
      it("errors if bad xml", async function () {
        const body = {
          SAMLRequest: "asdf",
        };
        await assert.rejects(samlObj.validateRedirectAsync(body, ""));
      });
      it("errors if idpIssuer is set and wrong issuer", async function () {
        samlObj.options.idpIssuer = "foo";
        await assert.rejects(
          samlObj.validateRedirectAsync(this.request, this.request.originalQuery),
          {
            message:
              "Unknown SAML issuer. Expected: foo Received: http://localhost:20000/saml2/idp/metadata.php",
          }
        );
      });
      it("errors if unsuccessful", async function () {
        this.request = JSON.parse(
          fs.readFileSync(__dirname + "/static/sp_slo_redirect_failure.json", "utf8")
        );
        await assert.rejects(
          samlObj.validateRedirectAsync(this.request, this.request.originalQuery),
          { message: "Bad status code: urn:oasis:names:tc:SAML:2.0:status:Requester" }
        );
      });
      it("errors if InResponseTo is not found", async function () {
        await assert.rejects(
          samlObj.validateRedirectAsync(this.request, this.request.originalQuery),
          { message: "InResponseTo is not valid" }
        );
      });
      it("errors if bad signature", async function () {
        await samlObj.cacheProvider.saveAsync("_79db1e7ad12ca1d63e5b", new Date().toISOString());
        this.request.Signature = "foo";
        await assert.rejects(
          samlObj.validateRedirectAsync(this.request, this.request.originalQuery),
          { message: "Invalid query signature" }
        );
      });

      it("returns true for valid signature", async function () {
        await samlObj.cacheProvider.saveAsync("_79db1e7ad12ca1d63e5b", new Date().toISOString());
        const { loggedOut } = await samlObj.validateRedirectAsync(
          this.request,
          this.request.originalQuery
        );
        expect(loggedOut).to.be.true;
      });

      it("accepts cert without header and footer line", async function () {
        samlObj.options.cert = fs.readFileSync(
          __dirname + "/static/acme_tools_com_without_header_and_footer.cert",
          "ascii"
        );
        await samlObj.cacheProvider.saveAsync("_79db1e7ad12ca1d63e5b", new Date().toISOString());
        const { loggedOut } = await samlObj.validateRedirectAsync(
          this.request,
          this.request.originalQuery
        );
        expect(loggedOut).to.be.true;
      });
    });
  });
});
